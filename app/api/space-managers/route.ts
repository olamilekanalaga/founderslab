import { z } from "zod";
import { requireViewer, requireCsrf, rateLimit } from "@/lib/auth";
import { body, json, failure } from "@/lib/http";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain";
import { issueManagerLink } from "@/lib/space-managers";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireViewer("team.manage");
    const managers = await db().spaceManager.findMany({
      include: {
        assignments: { select: { sessionId: true } },
        links: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { expiresAt: true, deliveredAt: true, usedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return json({
      managers: managers.map(({ links, ...m }) => ({
        ...m,
        status: m.revokedAt
          ? "Revoked"
          : m.verifiedAt
            ? "Active"
            : links[0]?.deliveredAt &&
                !links[0]?.usedAt &&
                links[0].expiresAt > new Date()
              ? "Pending"
              : "Expired",
        lastEmailAcceptedAt: links[0]?.deliveredAt || null,
      })),
      emailConfigured: Boolean(
        process.env.RESEND_API_KEY &&
        process.env.MANAGER_EMAIL_FROM &&
        process.env.APP_ORIGIN,
      ),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const viewer = await requireViewer("team.manage");
    requireCsrf(request, viewer);
    await rateLimit(`manager-admin:${viewer.id}`, 30, 15 * 60000);
    const p = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.literal("invite"),
            email: z.email().transform((v) => v.trim().toLowerCase()),
            sessionIds: z.array(z.string().min(1)).min(1).max(100),
          })
          .strict(),
        z
          .object({
            action: z.literal("assign"),
            id: z.string(),
            sessionIds: z.array(z.string().min(1)).max(100),
          })
          .strict(),
        z
          .object({ action: z.enum(["resend", "revoke"]), id: z.string() })
          .strict(),
      ])
      .parse(await body(request));
    if (p.action === "invite") {
      const manager = await db().$transaction(async (tx) => {
        const found = await tx.spaceManager.findUnique({
          where: { email: p.email },
        });
        if (found)
          throw new DomainError(
            "This email already has a manager record. Use Resend or edit its assignments.",
            409,
          );
        const manager = await tx.spaceManager.create({
          data: {
            email: p.email,
            assignments: {
              create: [...new Set(p.sessionIds)].map((sessionId) => ({
                sessionId,
              })),
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actor: viewer.name,
            action: "manager.invite",
            entityId: manager.id,
            detail:
              "Restricted manager created with assigned Spaces; email acceptance recorded separately.",
          },
        });
        return manager;
      });
      await issueManagerLink(manager.id, viewer.name);
      return json(
        {
          message:
            "Invitation email accepted by the provider. The sign-in link expires in 15 minutes.",
        },
        201,
      );
    }
    if (p.action === "resend") {
      await issueManagerLink(p.id, viewer.name);
      return json({
        message:
          "New sign-in email accepted by the provider. Older links are invalid.",
      });
    }
    await db().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SpaceManager" WHERE id = ${p.id} FOR UPDATE`;
      const manager = await tx.spaceManager.findUnique({ where: { id: p.id } });
      if (!manager) throw new DomainError("Manager not found.", 404);
      if (p.action === "revoke") {
        await tx.spaceManager.update({
          where: { id: p.id },
          data: { revokedAt: new Date() },
        });
        await tx.spaceManagerSession.deleteMany({ where: { managerId: p.id } });
        await tx.spaceManagerLink.updateMany({
          where: { managerId: p.id, usedAt: null },
          data: { usedAt: new Date() },
        });
      } else if (p.action === "assign") {
        if (manager.revokedAt)
          throw new DomainError("This manager has been revoked.", 403);
        await tx.spaceManagerAssignment.deleteMany({
          where: { managerId: p.id },
        });
        await tx.spaceManagerAssignment.createMany({
          data: [...new Set(p.sessionIds)].map((sessionId) => ({
            managerId: p.id,
            sessionId,
          })),
        });
      }
      await tx.auditLog.create({
        data: {
          actor: viewer.name,
          action: `manager.${p.action}`,
          entityId: p.id,
          detail:
            p.action === "revoke"
              ? "All sessions and unused email links invalidated; edit history preserved."
              : "Space assignments replaced.",
        },
      });
    });
    return json({
      message:
        p.action === "revoke"
          ? "Manager access revoked immediately."
          : "Assignments saved.",
    });
  } catch (e) {
    return failure(e);
  }
}
