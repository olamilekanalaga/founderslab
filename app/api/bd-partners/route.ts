import "server-only";
import { createDecipheriv, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireViewer, requireCsrf } from "@/server/auth";
import { db } from "@/server/db";
import { body, failure, json } from "@/server/http";
import { DomainError } from "@/lib/domain";
import {
  REFERRALS_PER_CYCLE,
  REWARD_NAIRA,
} from "@/features/bd-partners/rewards";

const text = z.string().trim().min(1).max(200);
const command = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register"),
    name: text,
    email: z.email().max(200),
    bank: text,
    accountName: text,
    accountNumber: z.string().regex(/^\d{10}$/),
  }),
  z.object({ action: z.literal("bank"), partnerId: z.uuid() }),
  z.object({
    action: z.literal("verify"),
    partnerId: z.uuid(),
    bookingId: text,
  }),
  z.object({
    action: z.literal("pay"),
    partnerId: z.uuid(),
    cycle: z.number().int().positive(),
    reference: text,
    paidOn: z.iso.date(),
  }),
]);

function bankKey() {
  const key = Buffer.from(process.env.BD_BANK_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32)
    throw new DomainError(
      "The original key is required to read this encrypted bank record.",
      503,
    );
  return key;
}

function readBankDetails(value: string) {
  if (value.startsWith("{")) return JSON.parse(value);
  const [version, nonce, tag, ciphertext] = value.split(":");
  if (version !== "v1") throw new Error("Unsupported encryption version");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    bankKey(),
    Buffer.from(nonce, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8"),
  );
}

export async function GET() {
  try {
    await requireViewer("team.manage");
    return json(
      await db().bdPartner.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          appearances: {
            select: {
              bookingId: true,
              sessionId: true,
              companyId: true,
              ordinal: true,
              verifiedAt: true,
            },
            orderBy: { ordinal: "asc" },
          },
          payments: {
            select: {
              cycle: true,
              amount: true,
              paidOn: true,
              reference: true,
            },
          },
        },
      }),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer("team.manage");
    requireCsrf(request, viewer);
    const payload = command.parse(await body(request));
    const result = await db().$transaction(async (tx) => {
      if (payload.action === "bank") {
        const partner = await tx.bdPartner.findUnique({
          where: { id: payload.partnerId },
          select: { bankDetails: true },
        });
        if (!partner) throw new DomainError("BD partner not found.", 404);
        const details = readBankDetails(partner.bankDetails);
        await tx.auditLog.create({
          data: {
            actor: viewer.id,
            action: "bd.bank.view",
            entityId: payload.partnerId,
            detail: "Admin viewed transfer details",
          },
        });
        return { details };
      }
      if (payload.action === "register") {
        const { name, email, bank, accountName, accountNumber } = payload;
        const partner = await tx.bdPartner.create({
          data: {
            id: randomUUID(),
            name,
            email: email.toLowerCase(),
            bankDetails: JSON.stringify({
              bank,
              accountName,
              accountNumber,
            }),
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            actor: viewer.id,
            action: "bd.register",
            entityId: partner.id,
            detail: "Admin-assisted registration",
          },
        });
        return;
      }
      // Serialize verification and payments for the same partner.
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "BdPartner" WHERE id = ${payload.partnerId} FOR UPDATE`;
      if (!locked.length) throw new DomainError("BD partner not found.", 404);
      const verified = await tx.bdAppearance.count({
        where: { partnerId: payload.partnerId },
      });
      if (payload.action === "verify") {
        await tx.$queryRaw`SELECT id FROM "BookingRequest" WHERE id = ${payload.bookingId} FOR UPDATE`;
        const booking = await tx.bookingRequest.findUnique({
          where: { id: payload.bookingId },
          include: {
            application: true,
            session: { include: { spaceData: { include: { teams: true } } } },
          },
        });
        const companyId = booking?.application.companyId;
        const founderId = booking?.application.founderId;
        if (
          !booking ||
          booking.status !== "Attended" ||
          booking.application.status !== "Approved" ||
          !companyId ||
          !founderId ||
          booking.session.status === "Cancelled" ||
          !booking.session.spaceData?.submittedAt ||
          !booking.session.spaceData.teams.some(
            (team) => team.companyId === companyId && team.foundersCount > 0,
          )
        ) {
          throw new DomainError(
            "Choose an attended booking for an approved application with submitted founder attendance.",
          );
        }
        const appearance = await tx.bdAppearance.create({
          data: {
            id: randomUUID(),
            partnerId: payload.partnerId,
            bookingId: booking.id,
            sessionId: booking.sessionId,
            companyId,
            ordinal: verified + 1,
          },
        });
        await tx.auditLog.create({
          data: {
            actor: viewer.id,
            action: "bd.verify",
            entityId: appearance.id,
            detail: "Admin verified founder appearance",
          },
        });
        return;
      }
      if (payload.cycle > Math.floor(verified / REFERRALS_PER_CYCLE))
        throw new DomainError("This reward cycle is not complete.");
      if (payload.paidOn > new Date().toISOString().slice(0, 10))
        throw new DomainError("Enter a payment date on or before today.");
      const payment = await tx.bdPayment.create({
        data: {
          id: randomUUID(),
          partnerId: payload.partnerId,
          cycle: payload.cycle,
          reference: payload.reference,
          paidOn: payload.paidOn,
          amount: REWARD_NAIRA,
        },
      });
      await tx.auditLog.create({
        data: {
          actor: viewer.id,
          action: "bd.pay",
          entityId: payment.id,
          detail: "Admin recorded a manual transfer",
        },
      });
    });
    return json(result ?? { saved: true });
  } catch (error) {
    return failure(error);
  }
}
