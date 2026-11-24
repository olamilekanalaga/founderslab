import "server-only";
import { cookies } from "next/headers";
import { db, hash, token } from "@/server/db";
import { DomainError } from "@/lib/domain";
import { requireCsrf } from "@/server/auth";
import type { Prisma } from "@prisma/client";

export const MANAGER_COOKIE = "fl_space_manager";
export async function managerSession() {
  const raw = (await cookies()).get(MANAGER_COOKIE)?.value;
  if (!raw) return null;
  const session = await db().spaceManagerSession.findUnique({
    where: { tokenHash: hash(raw) },
    include: { manager: true },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.manager.revokedAt ||
    !session.manager.verifiedAt
  )
    return null;
  return session;
}
export async function requireManager() {
  const session = await managerSession();
  if (!session)
    throw new DomainError(
      "Your manager access has expired or was revoked. Request a new email link.",
      401,
    );
  return session;
}
export function managerCsrf(request: Request, session: { csrf: string }) {
  requireCsrf(request, {
    id: "manager",
    name: "Space Manager",
    email: "",
    roleId: "space-manager",
    permissions: [],
    csrf: session.csrf,
  });
}
export async function lockManager(
  tx: Prisma.TransactionClient,
  managerId: string,
) {
  await tx.$queryRaw`SELECT id FROM "SpaceManager" WHERE id = ${managerId} FOR UPDATE`;
  const manager = await tx.spaceManager.findUnique({
    where: { id: managerId },
  });
  if (!manager || manager.revokedAt)
    throw new DomainError("Manager access revoked.", 401);
  return manager;
}
export async function sendManagerEmail(email: string, raw: string) {
  const key = process.env.RESEND_API_KEY?.trim(),
    from = process.env.MANAGER_EMAIL_FROM?.trim(),
    origin = process.env.APP_ORIGIN?.trim();
  if (!key || !from || !origin)
    throw new DomainError(
      "Email delivery is not configured. Set RESEND_API_KEY, MANAGER_EMAIL_FROM and APP_ORIGIN. No email was sent.",
      503,
    );
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    throw new DomainError(
      "Set APP_ORIGIN to the public Founders Lab origin.",
      503,
    );
  }
  if (
    !["https:", "http:"].includes(base.protocol) ||
    (process.env.VERCEL === "1" && base.protocol !== "https:") ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new DomainError(
      "Set APP_ORIGIN to the site origin with no path or query. Vercel requires HTTPS.",
      503,
    );
  const link = new URL("/manager/spaces", base);
  link.hash = `token=${raw}`;
  // A local mock is supported only outside hosted Vercel deployments, for isolated tests.
  const endpoint =
    process.env.VERCEL !== "1" &&
    process.env.TEST_EMAIL_ENDPOINT?.startsWith("http://127.0.0.1:")
      ? process.env.TEST_EMAIL_ENDPOINT
      : "https://api.resend.com/emails";
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${key}`,
        "Idempotency-Key": `space-manager/${hash(raw)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your Founders Lab Space Manager access",
        text: `Open your assigned Spaces: ${link.toString()}\n\nThis link expires in 15 minutes and can be used once. If you did not expect this invitation, ignore it.`,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new DomainError(
      "Email provider could not confirm acceptance. No usable invitation was issued. Try again.",
      502,
    );
  }
  const result = await response.json().catch(() => null);
  if (response.ok && typeof result?.id === "string" && result.id.trim()) return;
  const guidance =
    response.status === 401 || response.status === 403
      ? "Check the Resend sending key, sender domain verification and recipient restrictions."
      : response.status === 429
        ? "Check Resend rate limits and sending quota before retrying."
        : "Check the failed request in Resend Logs and verify the sender address.";
  throw new DomainError(`Resend did not confirm acceptance. ${guidance}`, 502);
}
export async function issueManagerLink(managerId: string, actor: string) {
  const raw = token();
  const link = await db().$transaction(async (tx) => {
    await lockManager(tx, managerId);
    await tx.spaceManagerLink.updateMany({
      where: { managerId, usedAt: null },
      data: { usedAt: new Date() },
    });
    return tx.spaceManagerLink.create({
      data: {
        managerId,
        tokenHash: hash(raw),
        expiresAt: new Date(Date.now() + 15 * 60000),
      },
      include: { manager: { select: { email: true } } },
    });
  });
  try {
    await sendManagerEmail(link.manager.email, raw);
  } catch (error) {
    await db().spaceManagerLink.update({
      where: { id: link.id },
      data: { usedAt: new Date() },
    });
    await db().auditLog.create({
      data: {
        actor,
        action: "manager.email.failed",
        entityId: managerId,
        detail:
          "Email provider did not confirm acceptance; attempted link invalidated.",
      },
    });
    throw error;
  }
  await db().$transaction(async (tx) => {
    await lockManager(tx, managerId);
    await tx.spaceManagerLink.update({
      where: { id: link.id },
      data: { deliveredAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actor,
        action: "manager.email.accepted",
        entityId: managerId,
        detail:
          "Sign-in email accepted by provider; not proof of inbox delivery.",
      },
    });
  });
}
export async function assignedSpaces(managerId: string) {
  const manager = await db().spaceManager.findFirst({
    where: { id: managerId, revokedAt: null },
    select: { allSpaces: true },
  });
  if (!manager) return [];
  return db().session.findMany({
    where: manager.allSpaces
      ? undefined
      : {
          managerAssignments: {
            some: { managerId, manager: { revokedAt: null } },
          },
        },
    select: {
      id: true,
      title: true,
      startsAt: true,
      timezone: true,
      recordingUrl: true,
      postUrl: true,
      spaceData: {
        select: {
          liveListeners: true,
          durationMinutes: true,
          submittedAt: true,
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });
}
