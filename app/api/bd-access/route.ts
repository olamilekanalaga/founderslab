import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireOrigin, rateLimit } from "@/server/auth";
import { db, hash, token } from "@/server/db";
import { body, failure, json } from "@/server/http";
import { DomainError } from "@/lib/domain";

import { BD_SESSION_COOKIE as COOKIE } from "@/server/services/bd-referral";
const SESSION_SECONDS = 30 * 86400;

export async function GET() {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw)
      return json({ error: "Sign in with your partner invitation." }, 401);
    const access = await db().bdAccess.findFirst({
      where: {
        tokenHash: hash(raw),
        purpose: "session",
        expiresAt: { gt: new Date() },
        partner: { active: true },
      },
      select: {
        partner: {
          select: {
            referralCode: true,
            applications: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                founderName: true,
                companyName: true,
                status: true,
                bdReviewStatus: true,
                bookings: {
                  select: {
                    id: true,
                    status: true,
                    session: {
                      select: {
                        spaceData: { select: { founderBookingIds: true } },
                      },
                    },
                  },
                },
              },
            },
            appearances: {
              where: { reversedAt: null },
              select: { bookingId: true },
            },
            payments: {
              orderBy: { createdAt: "desc" },
              select: { id: true, cycle: true, amount: true, paidOn: true },
            },
          },
        },
      },
    });
    if (!access)
      return json({ error: "Sign in with your partner invitation." }, 401);
    return json({
      ...access.partner,
      applications: access.partner.applications.map(
        ({ bdReviewStatus, ...application }) => ({
          ...application,
          bookings: application.bookings.map(({ id, status, session }) => ({
            id,
            status,
            attended:
              session.spaceData?.founderBookingIds.includes(id) ?? false,
          })),
          ineligible: ["self", "host", "disqualified"].includes(
            bdReviewStatus || "",
          ),
        }),
      ),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const command = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("verify"),
          token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        }),
        z.object({ action: z.literal("logout") }),
      ])
      .parse(await body(request));
    const store = await cookies();
    if (command.action === "logout") {
      const raw = store.get(COOKIE)?.value;
      if (raw)
        await db().bdAccess.deleteMany({
          where: { tokenHash: hash(raw), purpose: "session" },
        });
      store.delete(COOKIE);
      return json({ ok: true });
    }
    await rateLimit(
      `bd-login:${request.headers.get("x-forwarded-for") || "local"}`,
      20,
      15 * 60_000,
    );
    const tokenHash = hash(command.token);
    const invite = await db().bdAccess.findUnique({ where: { tokenHash } });
    if (!invite || invite.purpose !== "invite")
      throw new DomainError(
        "This partner invitation is invalid, expired or already used.",
        401,
      );
    const session = token();
    await db().$transaction(async (tx) => {
      const [partner] = await tx.$queryRaw<
        { active: boolean }[]
      >`SELECT active FROM "BdPartner" WHERE id = ${invite.partnerId} FOR UPDATE`;
      if (!partner?.active)
        throw new DomainError("Partner access is unavailable.", 401);
      const used = await tx.bdAccess.deleteMany({
        where: { tokenHash, purpose: "invite", expiresAt: { gt: new Date() } },
      });
      if (!used.count)
        throw new DomainError(
          "This partner invitation is invalid, expired or already used.",
          401,
        );
      await tx.bdAccess.create({
        data: {
          tokenHash: hash(session),
          partnerId: invite.partnerId,
          purpose: "session",
          expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
        },
      });
      await tx.auditLog.create({
        data: {
          actor: invite.partnerId,
          action: "bd.access.redeem",
          entityId: invite.partnerId,
          detail: "Redeemed partner dashboard invitation",
        },
      });
    });
    store.set(COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
