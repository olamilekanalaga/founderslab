import { z } from "zod";
import { cookies } from "next/headers";
import { db, hash, token } from "@/lib/db";
import { body, json, failure } from "@/lib/http";
import { requireOrigin, rateLimit } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { schemas } from "@/lib/validation";
import {
  assignedSpaces,
  requireManager,
  managerCsrf,
  lockManager,
  MANAGER_COOKIE,
  issueManagerLink,
} from "@/lib/space-managers";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    if ((await params).action !== "spaces")
      return json({ error: "Not found" }, 404);
    const session = await requireManager();
    await db().spaceManager.update({
      where: { id: session.managerId },
      data: { lastActivityAt: new Date() },
    });
    return json({
      spaces: await assignedSpaces(session.managerId),
      csrf: session.csrf,
    });
  } catch (e) {
    return failure(e);
  }
}
const saveSchema = schemas["space-data.save"]
  .pick({
    sessionId: true,
    liveListeners: true,
    durationMinutes: true,
    recordingUrl: true,
    postUrl: true,
    teams: true,
  })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    requireOrigin(request);
    const { action } = await params;
    if (action === "request-link") {
      const { email } = z
        .object({ email: z.email().transform((v) => v.toLowerCase()) })
        .parse(await body(request));
      await rateLimit(`manager-email:${email}`, 3, 15 * 60000);
      await rateLimit(
        `manager-email-ip:${request.headers.get("x-forwarded-for") || "local"}`,
        10,
        15 * 60000,
      );
      const manager = await db().spaceManager.findUnique({ where: { email } });
      if (manager && !manager.revokedAt)
        await issueManagerLink(manager.id, "Passwordless access request");
      return json({
        message:
          "If this email has active manager access, a sign-in email has been requested. Check your inbox.",
      });
    }
    if (action === "verify") {
      await rateLimit(
        `manager-verify:${request.headers.get("x-forwarded-for") || "local"}`,
        20,
        15 * 60000,
      );
      const { token: raw } = z
        .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
        .parse(await body(request));
      const found = await db().spaceManagerLink.findUnique({
        where: { tokenHash: hash(raw) },
      });
      if (!found)
        throw new DomainError("This link is invalid or expired.", 401);
      const sessionToken = token(),
        csrf = token();
      await db().$transaction(async (tx) => {
        const manager = await lockManager(tx, found.managerId);
        const claimed = await tx.spaceManagerLink.updateMany({
          where: {
            id: found.id,
            usedAt: null,
            deliveredAt: { not: null },
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });
        if (claimed.count !== 1)
          throw new DomainError(
            "This link is invalid, expired or already used.",
            401,
          );
        await tx.spaceManager.update({
          where: { id: manager.id },
          data: { verifiedAt: new Date(), lastActivityAt: new Date() },
        });
        await tx.spaceManagerSession.create({
          data: {
            managerId: manager.id,
            tokenHash: hash(sessionToken),
            csrf,
            expiresAt: new Date(Date.now() + 8 * 3600000),
          },
        });
        await tx.auditLog.create({
          data: {
            actor: manager.email,
            action: "manager.login",
            entityId: manager.id,
            detail: "Single-use email link verified.",
          },
        });
      });
      (await cookies()).set(MANAGER_COOKIE, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 3600,
      });
      return json({ ok: true });
    }
    const session = await requireManager();
    managerCsrf(request, session);
    await rateLimit(`manager-write:${session.managerId}`, 100, 15 * 60000);
    if (action === "logout") {
      await db().spaceManagerSession.deleteMany({ where: { id: session.id } });
      (await cookies()).delete(MANAGER_COOKIE);
      return json({ ok: true });
    }
    if (action !== "save") return json({ error: "Not found" }, 404);
    const p = saveSchema.parse(await body(request));
    if (new Set(p.teams.map((t) => t.companyId)).size !== p.teams.length)
      throw new DomainError("Duplicate attendance project.");
    await db().$transaction(async (tx) => {
      const manager = await lockManager(tx, session.managerId);
      const liveSession = await tx.spaceManagerSession.findUnique({
        where: { id: session.id },
      });
      if (!liveSession || liveSession.expiresAt <= new Date())
        throw new DomainError("Session expired.", 401);
      const assignment = await tx.spaceManagerAssignment.findUnique({
        where: {
          managerId_sessionId: {
            managerId: manager.id,
            sessionId: p.sessionId,
          },
        },
      });
      if (!assignment)
        throw new DomainError("This Space is not assigned to you.", 403);
      await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${p.sessionId} FOR UPDATE`;
      const participants = await tx.sessionParticipant.findMany({
        where: { sessionId: p.sessionId, attendance: { not: "Cancelled" } },
        select: { companyId: true },
      });
      if (
        p.teams.some(
          (t) => !participants.some((a) => a.companyId === t.companyId),
        )
      )
        throw new DomainError(
          "Attendance must belong to participating projects.",
          403,
        );
      await tx.session.update({
        where: { id: p.sessionId },
        data: { postUrl: p.postUrl, recordingUrl: p.recordingUrl },
      });
      const record = await tx.spaceData.upsert({
        where: { sessionId: p.sessionId },
        create: {
          sessionId: p.sessionId,
          liveListeners: p.liveListeners,
          durationMinutes: p.durationMinutes,
          recordedBy: manager.email,
        },
        update: {
          liveListeners: p.liveListeners,
          durationMinutes: p.durationMinutes,
          recordedBy: manager.email,
        },
      });
      for (const team of p.teams)
        await tx.spaceTeamAttendance.upsert({
          where: {
            spaceDataId_companyId: {
              spaceDataId: record.id,
              companyId: team.companyId,
            },
          },
          create: { ...team, spaceDataId: record.id },
          update: {
            foundersCount: team.foundersCount,
            otherTeamCount: team.otherTeamCount,
          },
        });
      await tx.spaceManager.update({
        where: { id: manager.id },
        data: { lastActivityAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actor: manager.email,
          action: "manager.space.save",
          entityId: p.sessionId,
          detail:
            "Updated assigned Space attendance, audience, duration and shared links.",
        },
      });
    });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
