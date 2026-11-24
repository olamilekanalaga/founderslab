import "server-only";
import {
  lockProgramme,
  ensureProgrammeWindow,
} from "@/server/services/programme-window";
import { z } from "zod";
import { bdRegistration } from "@/lib/validation/bd-partner";
import { registerBdPartner } from "@/server/services/bd-registration";
import { cookies } from "next/headers";
import { db, hash, token } from "@/server/db";
import { body, json, failure } from "@/server/http";
import { requireOrigin, rateLimit } from "@/server/auth";
import { managerPasswordAuth } from "@/server/services/manager-password";
import { DomainError } from "@/lib/domain";
import { schemas } from "@/lib/validation";
import {
  assignedSpaces,
  requireManager,
  managerCsrf,
  lockManager,
  MANAGER_COOKIE,
  issueManagerLink,
} from "@/server/services/space-managers";

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
      workspaceAccess: session.manager.allSpaces,
    });
  } catch (e) {
    return failure(e);
  }
}
const saveSchema = schemas["space-data.save"]
  .pick({
    submit: true,
    sessionId: true,
    liveListeners: true,
    durationMinutes: true,
    recordingUrl: true,
    postUrl: true,
  })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    requireOrigin(request);
    const { action } = await params;
    if (action === "password-login" || action === "password-setup")
      return await managerPasswordAuth(request, action);
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
      if (manager && !manager.revokedAt) {
        // Keep public responses uniform; delivery/configuration details belong to Admin.
        try {
          await issueManagerLink(manager.id, "Passwordless access request");
        } catch {}
      }
      return json({
        message:
          "Request received. If this address has active manager access, check its inbox. Contact the administrator if no link arrives.",
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
      if (!found || found.passwordSetup)
        throw new DomainError("This link is invalid or expired.", 401);
      const sessionToken = token(),
        csrf = token();
      await db().$transaction(async (tx) => {
        const manager = await lockManager(tx, found.managerId);
        if (found.manual && !manager.allSpaces)
          throw new DomainError(
            "This link is invalid, expired or already used.",
            401,
          );
        const claimed = await tx.spaceManagerLink.updateMany({
          where: {
            id: found.id,
            usedAt: null,
            ...(found.manual ? {} : { deliveredAt: { not: null } }),
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
            detail: found.manual
              ? "Single-use manual invitation redeemed."
              : "Single-use email link verified.",
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
    if (action === "register-bd") {
      await rateLimit(`manager-bd:${session.managerId}`, 15, 60 * 60000);
      const details = bdRegistration.strict().parse(await body(request));
      await db().$transaction(async (tx) => {
        const manager = await lockManager(tx, session.managerId);
        const active = await tx.spaceManagerSession.findUnique({
          where: { id: session.id },
        });
        if (!active || active.expiresAt <= new Date())
          throw new DomainError("Session expired.", 401);
        await registerBdPartner(
          tx,
          details,
          `Space Manager ${manager.id}`,
          "Space Manager entered an owner-approved BD partner",
        );
      });
      return json({ saved: true });
    }
    if (action !== "save") return json({ error: "Not found" }, 404);
    const p = saveSchema.parse(await body(request));
    await db().$transaction(async (tx) => {
      const manager = await lockManager(tx, session.managerId);
      await lockProgramme(tx);
      const liveSession = await tx.spaceManagerSession.findUnique({
        where: { id: session.id },
      });
      if (!liveSession || liveSession.expiresAt <= new Date())
        throw new DomainError("Session expired.", 401);
      if (!manager.allSpaces) {
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
      }
      await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${p.sessionId} FOR UPDATE`;
      const event = await tx.session.findUnique({ where: { id: p.sessionId } });
      if (!event) throw new DomainError("Space not found.", 404);
      if (p.submit) {
        if (event.startsAt > new Date())
          throw new DomainError(
            "Attendance can only be submitted after the Space starts.",
          );
        if (p.liveListeners === null || p.durationMinutes === null)
          throw new DomainError(
            "Enter listeners and duration before submitting the Space report.",
          );
      }
      await tx.session.update({
        where: { id: p.sessionId },
        data: {
          postUrl: p.postUrl,
          recordingUrl: p.recordingUrl,
          ...(p.submit ? { status: "Completed" } : {}),
        },
      });
      const record = await tx.spaceData.upsert({
        where: { sessionId: p.sessionId },
        create: {
          sessionId: p.sessionId,
          liveListeners: p.liveListeners,
          durationMinutes: p.durationMinutes,
          recordedBy: manager.email,
          ...(p.submit
            ? { submittedAt: new Date(), submittedBy: manager.email }
            : {}),
        },
        update: {
          liveListeners: p.liveListeners,
          durationMinutes: p.durationMinutes,
          recordedBy: manager.email,
        },
      });
      if (p.submit && !record.submittedAt)
        await tx.spaceData.update({
          where: { id: record.id },
          data: { submittedAt: new Date(), submittedBy: manager.email },
        });
      if (p.submit) await ensureProgrammeWindow(tx);
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
            "Updated assigned Space audience, duration and shared links; team attendance preserved.",
        },
      });
    });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
