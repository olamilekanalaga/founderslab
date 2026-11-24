import "server-only";
import { createDecipheriv, randomUUID } from "node:crypto";
import { z } from "zod";
import { bdRegistration } from "@/lib/validation/bd-partner";
import { registerBdPartner } from "@/server/services/bd-registration";
import { requireCsrf } from "@/server/auth";
import { requireBdOperator } from "@/server/auth/workspace";
import { db, hash, token } from "@/server/db";
import { body, failure, json } from "@/server/http";
import { DomainError } from "@/lib/domain";
import {
  REFERRALS_PER_CYCLE,
  REWARD_NAIRA,
} from "@/features/bd-partners/rewards";

const text = z.string().trim().min(1).max(200);
const command = z.discriminatedUnion("action", [
  bdRegistration.extend({ action: z.literal("register") }),
  z.object({ action: z.literal("bank"), partnerId: z.uuid() }),
  z.object({
    action: z.literal("reverse"),
    partnerId: z.uuid(),
    appearanceId: z.uuid(),
    reason: text,
  }),
  z.object({ action: z.literal("access"), partnerId: z.uuid() }),
  z.object({
    action: z.literal("profile"),
    partnerId: z.uuid(),
    fullName: text.optional(),
    xHandle: z
      .string()
      .trim()
      .regex(/^@?[A-Za-z0-9_]{1,15}$/)
      .optional(),
    active: z.boolean(),
  }),

  z.object({
    action: z.literal("attribute"),
    partnerId: z.uuid(),
    applicationId: text,
  }),
  z.object({
    action: z.literal("verify"),
    partnerId: z.uuid(),
    bookingId: text,
  }),
  z.object({
    action: z.literal("pay"),
    partnerId: z.uuid(),
    cycle: z.number().int().positive(),
    reference: z.string().trim().max(200).optional(),
    amount: z.number().int().positive().max(REWARD_NAIRA).optional(),
    requestId: z.uuid().optional(),
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
    await requireBdOperator();
    return json(
      await db().bdPartner.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          fullName: true,
          referralCode: true,
          active: true,
          createdAt: true,
          appearances: {
            select: {
              id: true,
              reversedAt: true,
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
              id: true,
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
    const viewer = await requireBdOperator();
    requireCsrf(request, viewer);
    const payload = command.parse(await body(request));
    if (
      ["access", "profile"].includes(payload.action) &&
      !viewer.permissions.includes("team.manage")
    )
      throw new DomainError(
        "Only the owner can manage partner access or identity.",
        403,
      );
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
            actor: viewer.name,
            action: "bd.bank.view",
            entityId: payload.partnerId,
            detail: "Viewed transfer details",
          },
        });
        return { details };
      }
      if (payload.action === "register") {
        return await registerBdPartner(
          tx,
          payload,
          viewer.id,
          "Admin-assisted registration",
        );
      }
      // Serialize verification and payments for the same partner.
      const locked = await tx.$queryRaw<
        { id: string; active: boolean }[]
      >`SELECT id, active FROM "BdPartner" WHERE id = ${payload.partnerId} FOR UPDATE`;
      if (!locked.length) throw new DomainError("BD partner not found.", 404);
      if (payload.action === "profile") {
        const name =
          payload.xHandle &&
          "@" + payload.xHandle.replace(/^@/, "").toLowerCase();
        if (name) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"bd-handle:" + name}))`;
          const code = name.slice(1);
          const duplicates = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "BdPartner" WHERE id <> ${payload.partnerId}
            AND (lower(name) = ${name} OR "referralCode" = ${code}) LIMIT 1
          `;
          if (duplicates.length)
            throw new DomainError("This X username is already in use.", 409);
        }
        await tx.bdPartner.update({
          where: { id: payload.partnerId },
          data: {
            fullName: payload.fullName,
            name: name || undefined,
            active: payload.active,
          },
        });
        if (!payload.active)
          await tx.bdAccess.deleteMany({
            where: { partnerId: payload.partnerId },
          });
        await tx.auditLog.create({
          data: {
            actor: viewer.name,
            action: "bd.profile",
            entityId: payload.partnerId,
            detail: payload.active
              ? "Updated active partner profile"
              : "Revoked partner referral and dashboard access",
          },
        });
        return;
      }
      if (payload.action === "access") {
        if (!locked[0].active)
          throw new DomainError("This partner is inactive.", 409);
        const address = new URL("/bd", request.headers.get("origin")!);
        if (process.env.VERCEL === "1" && address.protocol !== "https:")
          throw new DomainError("Dashboard invitations require HTTPS.");
        const raw = token();
        await tx.bdAccess.deleteMany({
          where: { partnerId: payload.partnerId, purpose: "invite" },
        });
        await tx.bdAccess.create({
          data: {
            tokenHash: hash(raw),
            partnerId: payload.partnerId,
            purpose: "invite",
            expiresAt: new Date(Date.now() + 15 * 60_000),
          },
        });
        await tx.auditLog.create({
          data: {
            actor: viewer.name,
            action: "bd.access.issue",
            entityId: payload.partnerId,
            detail: "Issued one-time partner dashboard invitation",
          },
        });
        address.hash = `token=${raw}`;
        return { accessLink: address.href };
      }
      if (payload.action === "reverse") {
        const change = await tx.bdAppearance.updateMany({
          where: {
            id: payload.appearanceId,
            partnerId: payload.partnerId,
            reversedAt: null,
          },
          data: { reversedAt: new Date() },
        });
        if (!change.count)
          throw new DomainError(
            "This verification has already been reversed or is unavailable.",
            409,
          );
        await tx.auditLog.create({
          data: {
            actor: viewer.name,
            action: "bd.verify.reverse",
            entityId: payload.appearanceId,
            detail: payload.reason,
          },
        });
        return;
      }
      if (payload.action === "attribute") {
        if (!locked[0].active)
          throw new DomainError("This partner is inactive.", 409);
        const assigned = await tx.application.updateMany({
          where: {
            id: payload.applicationId,
            bdReferrerXHandle: { not: null },
            bdPartnerId: null,
          },
          data: { bdPartnerId: payload.partnerId },
        });
        if (!assigned.count)
          throw new DomainError(
            "This referral is already assigned or unavailable.",
            409,
          );
        await tx.auditLog.create({
          data: {
            actor: viewer.name,
            action: "bd.attribute",
            entityId: payload.applicationId,
            detail: `Linked referred application to BD partner ${payload.partnerId}`,
          },
        });
        return;
      }
      const verified = await tx.bdAppearance.count({
        where: { partnerId: payload.partnerId, reversedAt: null },
      });
      if (payload.action === "verify") {
        const sessionTarget = await tx.bookingRequest.findUnique({
          where: { id: payload.bookingId },
          select: { sessionId: true },
        });
        if (!sessionTarget) throw new DomainError("Booking not found.", 404);
        await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionTarget.sessionId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "BookingRequest" WHERE id = ${payload.bookingId} FOR UPDATE`;
        const booking = await tx.bookingRequest.findUnique({
          where: { id: payload.bookingId },
          include: {
            application: true,
            session: { include: { spaceData: { include: { teams: true } } } },
          },
        });
        if (booking && booking.application.bdPartnerId !== payload.partnerId)
          throw new DomainError(
            "This booking is not attributed to this BD partner.",
            409,
          );
        const companyId = booking?.application.companyId;
        const founderId = booking?.application.founderId;
        if (
          !booking ||
          booking.status !== "Attended" ||
          booking.application.status !== "Approved" ||
          !companyId ||
          !founderId ||
          booking.session.status !== "Completed" ||
          !booking.session.spaceData?.submittedAt ||
          !booking.session.spaceData.teams.some(
            (team) => team.companyId === companyId && team.foundersCount > 0,
          )
        ) {
          throw new DomainError(
            "Choose an attended booking for an approved application with submitted founder attendance.",
          );
        }
        const prior = await tx.bdAppearance.findUnique({
          where: { bookingId: booking.id },
        });
        if (
          prior &&
          (!prior.reversedAt || prior.partnerId !== payload.partnerId)
        )
          throw new DomainError(
            "This appearance has already been credited.",
            409,
          );
        const latest = await tx.bdAppearance.aggregate({
          where: { partnerId: payload.partnerId },
          _max: { ordinal: true },
        });
        const appearance = prior
          ? await tx.bdAppearance.update({
              where: { id: prior.id },
              data: { reversedAt: null, verifiedAt: new Date() },
            })
          : await tx.bdAppearance.create({
              data: {
                id: randomUUID(),
                partnerId: payload.partnerId,
                bookingId: booking.id,
                sessionId: booking.sessionId,
                companyId,
                ordinal: (latest._max.ordinal ?? 0) + 1,
              },
            });
        await tx.auditLog.create({
          data: {
            actor: viewer.name,
            action: "bd.verify",
            entityId: appearance.id,
            detail: "Verified founder appearance",
          },
        });
        return;
      }
      if (payload.cycle > Math.floor(verified / REFERRALS_PER_CYCLE))
        throw new DomainError("This reward cycle is not complete.");
      if (payload.paidOn > new Date().toISOString().slice(0, 10))
        throw new DomainError("Enter a payment date on or before today.");
      if (
        payload.requestId &&
        (await tx.bdPayment.findUnique({
          where: { requestId: payload.requestId },
        }))
      )
        throw new DomainError(
          "This payment request was already recorded.",
          409,
        );
      const payments = await tx.bdPayment.findMany({
        where: { partnerId: payload.partnerId },
        select: { cycle: true, amount: true },
      });
      const totalPaid = payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      const paidForCycle = payments
        .filter((payment) => payment.cycle === payload.cycle)
        .reduce((sum, payment) => sum + payment.amount, 0);
      const available = Math.min(
        REWARD_NAIRA - paidForCycle,
        Math.floor(verified / REFERRALS_PER_CYCLE) * REWARD_NAIRA - totalPaid,
      );
      const amount = payload.amount ?? REWARD_NAIRA;
      if (amount !== REWARD_NAIRA && !payload.requestId)
        throw new DomainError(
          "A request ID is required for a partial payment.",
        );
      if (amount > available)
        throw new DomainError(
          "This payment would exceed earned commission or the remaining cycle balance.",
          409,
        );
      const payment = await tx.bdPayment.create({
        data: {
          id: randomUUID(),
          partnerId: payload.partnerId,
          cycle: payload.cycle,
          reference: payload.reference || null,
          requestId: payload.requestId,
          paidOn: payload.paidOn,
          amount,
        },
      });
      await tx.auditLog.create({
        data: {
          actor: viewer.name,
          action: "bd.pay",
          entityId: payment.id,
          detail: "Recorded a manual transfer",
        },
      });
    });
    return json(result ?? { saved: true });
  } catch (error) {
    return failure(error);
  }
}
