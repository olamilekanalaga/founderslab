import "server-only";
import {
  RETIRED_AWARD_COMMANDS,
  RETIRED_AWARD_MESSAGE,
} from "@/lib/programme-policy";
import { z } from "zod";
import { body, json, failure } from "@/server/http";
import { db, loadState, executeCommand } from "@/server/db";
import { requireViewer, requireCsrf } from "@/server/auth";
import { actionPermission } from "@/lib/catalog";
import { DomainError, scopeState } from "@/lib/domain";
import { schemas } from "@/lib/validation";

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
    if (RETIRED_AWARD_COMMANDS.some((type) => type === command.type)) {
      throw new DomainError(RETIRED_AWARD_MESSAGE, 410);
    }
    if (command.type === "invite.create") {
      throw new DomainError("Administrator invitations are disabled.", 403);
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
