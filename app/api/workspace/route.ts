import { z } from "zod";
import { body, json, failure } from "@/lib/http";
import { db, hash, token, loadState, executeCommand } from "@/lib/db";
import { requireViewer, requireCsrf } from "@/lib/auth";
import { actionPermission } from "@/lib/catalog";
import { DomainError, scopeState } from "@/lib/domain";
import { schemas } from "@/lib/validation";
export const runtime = "nodejs";
export async function GET() {
  try {
    const viewer = await requireViewer();
    return json({
      state: scopeState(await loadState(), viewer.permissions),
      viewer,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const viewer = await requireViewer();
    requireCsrf(request, viewer);
    const command = z
      .object({ type: z.string(), payload: z.record(z.string(), z.unknown()) })
      .parse(await body(request));
    const permission = actionPermission(command.type);
    if (!permission || !viewer.permissions.includes(permission))
      throw new DomainError("Permission required.", 403);
    if (command.type === "invite.create") {
      const p = schemas["invite.create"].parse(command.payload),
        raw = token();
      if (await db().user.findUnique({ where: { email: p.email } }))
        throw new DomainError("This team member already exists.");
      await db().invitation.create({
        data: {
          ...p,
          tokenHash: hash(raw),
          invitedBy: viewer.id,
          expiresAt: new Date(Date.now() + 7 * 864e5),
        },
      });
      await db().auditLog.create({
        data: {
          actor: viewer.name,
          action: "invite.create",
          entityId: p.email,
          detail: "Invitation link created for manual sharing; no email sent.",
        },
      });
      return json({
        state: scopeState(await loadState(), viewer.permissions),
        invitationPath: `/invite#token=${raw}`,
      });
    }
    if (command.type === "user.permissions") {
      const p = schemas["user.permissions"].parse(command.payload);
      if (
        p.id === viewer.id &&
        (!p.active || !p.permissions.includes("team.manage"))
      )
        throw new DomainError(
          "You cannot remove your own team-management access.",
        );
      await db().$transaction(async (tx) => {
        // Serialise administrator privilege changes to preserve at least one active admin.
        await tx.$queryRaw`SELECT id FROM "Role" WHERE id = 'admin' FOR UPDATE`;
        const target = await tx.user.findUnique({ where: { id: p.id } });
        if (!target) throw new DomainError("User not found");
        if (
          target.roleId === "admin" &&
          (!p.active || !p.permissions.includes("team.manage"))
        )
          throw new DomainError(
            "Administrators must retain team management. Create a collaborator account for limited access.",
          );
        await tx.user.update({
          where: { id: p.id },
          data: {
            active: p.active,
            customPermissions: true,
            grants: {
              deleteMany: {},
              create: p.permissions.map((permissionId) => ({ permissionId })),
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actor: viewer.name,
            action: command.type,
            entityId: p.id,
            detail: "Team permissions updated",
          },
        });
      });
      return json({ state: scopeState(await loadState(), viewer.permissions) });
    }
    return json({ state: await executeCommand(command, viewer) });
  } catch (e) {
    return failure(e);
  }
}
