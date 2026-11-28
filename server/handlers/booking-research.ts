import "server-only";
import { z } from "zod";
import {
  businessDiscoverySchema,
  researchNoteSchema,
  researchStatusSchema,
} from "@/lib/business-research";
import { DomainError } from "@/lib/domain";
import { requireCsrf } from "@/server/auth";
import { requireWorkspaceViewer } from "@/server/auth/workspace";
import { db, hash, token } from "@/server/db";
import { body, failure, json } from "@/server/http";
import {
  activeResearchBookings,
  discoveryLinkEligible,
  researchQueueEligible,
} from "@/server/services/business-research";

const id = z.string().min(1).max(200);
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("issue-link"), applicationId: id }),
  z.object({
    action: z.literal("save"),
    applicationId: id,
    status: researchStatusSchema,
    notes: researchNoteSchema,
    revision: z.number().int().nonnegative(),
  }),
]);

const bookingSelect = {
  where: activeResearchBookings,
  orderBy: { createdAt: "desc" },
  select: { status: true, session: { select: { startsAt: true } } },
  take: 1,
} as const;

export async function GET(request: Request) {
  try {
    const viewer = await requireWorkspaceViewer();
    if (!viewer.permissions.includes("research.read"))
      throw new DomainError("Permission required.", 403);
    const applicationId = new URL(request.url).searchParams.get("application");
    if (applicationId) {
      const row = await db().application.findFirst({
        where: { id: id.parse(applicationId), ...researchQueueEligible },
        select: {
          id: true,
          founderName: true,
          companyName: true,
          description: true,
          website: true,
          xHandle: true,
          projectXHandle: true,
          discussionPreference: true,
          bookings: bookingSelect,
          businessResearch: {
            select: {
              discovery: true,
              submittedAt: true,
              notes: true,
              status: true,
              revision: true,
              linkExpiresAt: true,
            },
          },
        },
      });
      if (!row) throw new DomainError("Research workspace not found.", 404);
      const { businessResearch, bookings, ...identity } = row;
      return json({
        ...identity,
        booking: bookings[0] ?? null,
        discovery: businessResearch?.discovery ?? null,
        submittedAt: businessResearch?.submittedAt ?? null,
        status: businessResearch?.status ?? "Pending",
        notes: businessResearch?.notes ?? {},
        revision: businessResearch?.revision ?? 0,
        linkExpiresAt: businessResearch?.linkExpiresAt ?? null,
      });
    }
    const rows = await db().application.findMany({
      where: researchQueueEligible,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        founderName: true,
        companyName: true,
        bookings: bookingSelect,
        businessResearch: {
          select: { discovery: true, submittedAt: true, status: true },
        },
      },
    });
    return json(
      rows.map(({ businessResearch, bookings, ...row }) => ({
        ...row,
        booking: bookings[0] ?? null,
        challenge: businessResearch?.discovery
          ? businessDiscoverySchema.parse(businessResearch.discovery).challenges
          : "",
        submittedAt: businessResearch?.submittedAt ?? null,
        status: businessResearch?.status ?? "Pending",
      })),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireWorkspaceViewer();
    requireCsrf(request, viewer);
    if (
      !viewer.permissions.includes("research.write") ||
      !viewer.permissions.includes("research.read")
    )
      throw new DomainError("Permission required.", 403);
    const input = command.parse(await body(request));
    const result = await db().$transaction(async (tx) => {
      const application = await tx.application.findFirst({
        where: {
          id: input.applicationId,
          ...(input.action === "issue-link"
            ? discoveryLinkEligible
            : researchQueueEligible),
        },
        select: { id: true },
      });
      if (!application)
        throw new DomainError("Research workspace not found.", 404);
      const applicationId = application.id;
      await tx.applicationResearch.createMany({
        data: { applicationId },
        skipDuplicates: true,
      });

      if (input.action === "issue-link") {
        const raw = token();
        const expiresAt = new Date(Date.now() + 14 * 86_400_000);
        const changed = await tx.applicationResearch.updateMany({
          where: {
            applicationId,
            submittedAt: null,
            application: discoveryLinkEligible,
          },
          data: { linkHash: hash(raw), linkExpiresAt: expiresAt },
        });
        if (!changed.count)
          throw new DomainError(
            "Business discovery has already been submitted.",
            409,
          );
        await tx.auditLog.create({
          data: {
            actor: viewer.name,
            action: "research.discovery-link",
            entityId: applicationId,
            detail: "Issued business discovery link",
          },
        });
        return { token: raw, expiresAt };
      }

      const changed = await tx.applicationResearch.updateMany({
        where: { applicationId, revision: input.revision },
        data: {
          status: input.status,
          notes: input.notes,
          revision: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new DomainError(
          "Someone else saved this workspace. Reopen it before editing again.",
          409,
        );
      await tx.auditLog.create({
        data: {
          actor: viewer.name,
          action: "research.workspace.save",
          entityId: applicationId,
          detail: input.status,
        },
      });
      return { status: input.status, revision: input.revision + 1 };
    });
    return json(result);
  } catch (error) {
    return failure(error);
  }
}
