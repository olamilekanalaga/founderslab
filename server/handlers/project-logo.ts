import "server-only";

import { requireWorkspaceViewer } from "@/server/auth/workspace";
import { db } from "@/server/db";
import { DomainError } from "@/lib/domain";
import { PROJECT_LOGO_PREFIX } from "@/lib/validation/project-logo";
import { failure } from "@/server/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await requireWorkspaceViewer();
    const canReadBookings = viewer.permissions.includes("booking.read");
    if (!canReadBookings && !viewer.permissions.includes("directory.read"))
      throw new DomainError("Permission required.", 403);
    const { id } = await params;
    const logo = await db().projectLogo.findUnique({
      where: {
        applicationId: id,
        application: canReadBookings
          ? undefined
          : { status: "Approved", companyId: { not: null } },
      },
      select: { image: true },
    });
    if (!logo) throw new DomainError("Company logo not found.", 404);
    return new Response(
      Uint8Array.from(
        Buffer.from(logo.image.slice(PROJECT_LOGO_PREFIX.length), "base64"),
      ),
      {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
