import "server-only";
import { getViewer } from "@/server/auth/session";
import { managerSession } from "@/server/services/space-managers";
import { DomainError } from "@/lib/domain";
import type { Viewer } from "@/lib/types";

export async function getWorkspaceViewer(): Promise<Viewer | null> {
  const owner = await getViewer();
  if (owner) return owner;

  const session = await managerSession();
  if (!session?.manager.allSpaces) return null;
  return {
    id: session.managerId,
    name: session.manager.email,
    email: session.manager.email,
    roleId: "space-manager",
    permissions: [
      "directory.read",
      "directory.write",
      "booking.read",
      "booking.write",
      "reports.read",
    ],
    csrf: session.csrf,
  };
}

export async function requireWorkspaceViewer() {
  const viewer = await getWorkspaceViewer();
  if (!viewer)
    throw new DomainError("Sign in to access the private workspace.", 401);
  return viewer;
}

export async function requireBdOperator() {
  const viewer = await requireWorkspaceViewer();
  if (
    viewer.roleId !== "space-manager" &&
    !viewer.permissions.includes("team.manage")
  )
    throw new DomainError("Permission required.", 403);
  return viewer;
}
