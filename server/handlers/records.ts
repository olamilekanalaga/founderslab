import "server-only";
import { z } from "zod";
import { requireViewer, requireCsrf, rateLimit } from "@/server/auth";
import { db, loadState } from "@/server/db";
import { body, json, failure } from "@/server/http";
import { DomainError, scopeState } from "@/lib/domain";
import { lockProgramme } from "@/server/services/programme-window";

export async function DELETE(request: Request) {
  try {
    const viewer = await requireViewer("directory.write");
    requireCsrf(request, viewer);
    await rateLimit(`record-delete:${viewer.id}`, 30, 15 * 60000);
    const p = z
      .object({
        kind: z.enum(["founder", "application"]),
        id: z.string().min(1),
        confirmation: z.literal("DELETE"),
      })
      .strict()
      .parse(await body(request));
    await db().$transaction(
      async (tx) => {
        await lockProgramme(tx);
        const application =
          p.kind === "application"
            ? await tx.application.findUnique({ where: { id: p.id } })
            : null;
        const founderId = p.kind === "founder" ? p.id : application?.founderId;
        if (p.kind === "application" && !application)
          throw new DomainError("Application not found.", 404);
        const founder = founderId
          ? await tx.founder.findUnique({ where: { id: founderId } })
          : null;
        if (founderId && !founder)
          throw new DomainError("Founder not found.", 404);
        const handle = founder?.xHandle.replace(/^@/, "");
        const apps = founder
          ? await tx.application.findMany({
              where: {
                OR: [
                  { founderId: founder.id },
                  {
                    xHandle: {
                      in: [handle!, `@${handle}`],
                      mode: "insensitive",
                    },
                  },
                ],
              },
              select: { id: true, companyId: true },
            })
          : [application!];
        const appIds = apps.map((a) => a.id);
        const companies = new Set(
          apps
            .map((a) => a.companyId)
            .filter((id): id is string => Boolean(id)),
        );
        const erasedIds = [...appIds, ...(founder ? [founder.id] : [])];
        if (founder) {
          const memberships = await tx.founderCompanyMembership.findMany({
            where: { founderId: founder.id },
          });
          memberships.forEach((m) => companies.add(m.companyId));
          const research = await tx.researchRecord.findMany({
            where: { founderId: founder.id },
            select: { id: true },
          });
          erasedIds.push(...research.map((r) => r.id));
          const opportunities = await tx.opportunity.findMany({
            where: { founderId: founder.id },
            select: { id: true },
          });
          erasedIds.push(...opportunities.map((r) => r.id));
          await tx.opportunity.deleteMany({ where: { founderId: founder.id } });
          await tx.researchRecord.deleteMany({
            where: { founderId: founder.id },
          });
          await tx.awardDecision.deleteMany({
            where: { founderId: founder.id },
          });
          await tx.campaignParticipant.deleteMany({
            where: { founderId: founder.id },
          });
          await tx.sessionParticipant.deleteMany({
            where: { founderId: founder.id },
          });
          await tx.founderCompanyMembership.deleteMany({
            where: { founderId: founder.id },
          });
        }
        await tx.bookingRequest.deleteMany({
          where: { applicationId: { in: appIds } },
        });
        await tx.application.deleteMany({ where: { id: { in: appIds } } });
        if (founder) await tx.founder.delete({ where: { id: founder.id } });
        for (const id of companies) {
          const company = await tx.company.findUnique({
            where: { id },
            include: {
              _count: {
                select: {
                  memberships: true,
                  applications: true,
                  participants: true,
                  research: true,
                  opportunities: true,
                },
              },
            },
          });
          if (!company || Object.values(company._count).some((n) => n > 0))
            continue;
          await tx.companyRelationship.deleteMany({
            where: { OR: [{ companyAId: id }, { companyBId: id }] },
          });
          await tx.businessNeed.deleteMany({ where: { companyId: id } });
          await tx.companyLabel.deleteMany({ where: { companyId: id } });
          await tx.spaceTeamAttendance.deleteMany({ where: { companyId: id } });
          await tx.company.delete({ where: { id } });
          erasedIds.push(id);
        }
        await tx.auditLog.deleteMany({
          where: { entityId: { in: erasedIds } },
        });
        await tx.auditLog.create({
          data: {
            actor: viewer.name,
            action: "record.permanently-deleted",
            entityId: crypto.randomUUID(),
            detail:
              "Permanently removed a founder/application and its owned linked records. Shared sessions retained. No deleted personal information retained in this audit entry.",
          },
        });
      },
      { timeout: 30000 },
    );
    return json({ state: scopeState(await loadState(), viewer.permissions) });
  } catch (e) {
    return failure(e);
  }
}
