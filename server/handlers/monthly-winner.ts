import "server-only";
import { z } from "zod";
import { requireViewer, requireCsrf } from "@/server/auth";
import { db, loadState } from "@/server/db";
import { body, json, failure } from "@/server/http";
import { DomainError, scopeState } from "@/lib/domain";
import { londonDay } from "@/lib/dates/saturday-schedule";

export async function POST(request: Request) {
  try {
    const viewer = await requireViewer("campaign.write");
    requireCsrf(request, viewer);
    const p = z
      .object({
        period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        founderId: z.string().min(1),
      })
      .strict()
      .parse(await body(request));
    await db().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(67234911)`;
      const appearances = await tx.sessionParticipant.findMany({
        where: { founderId: p.founderId, attendance: { not: "Cancelled" } },
        select: { session: { select: { startsAt: true } } },
      });
      if (
        !appearances.some(
          (a) => londonDay(a.session.startsAt).slice(0, 7) === p.period,
        )
      )
        throw new DomainError(
          "Choose a founder from a Space in this month.",
          400,
        );
      const campaign = await tx.campaign.upsert({
        where: { period: p.period },
        create: {
          name: new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "Europe/London",
          }).format(new Date(p.period + "-15T12:00:00Z")),
          period: p.period,
          target: 20,
          awardAmount: "1 SOL",
          rules: "",
          criteria: "",
          status: "Completed",
        },
        update: {},
      });
      const old = await tx.awardDecision.findUnique({
        where: { campaignId: campaign.id },
      });
      await tx.awardDecision.upsert({
        where: { campaignId: campaign.id },
        create: {
          campaignId: campaign.id,
          founderId: p.founderId,
          reviewer: viewer.name,
          rationale: "",
          decisionDate: new Date(),
          status: "Selected",
          transactionReference: "",
        },
        update: {
          founderId: p.founderId,
          reviewer: viewer.name,
          decisionDate: new Date(),
          ...(old?.founderId !== p.founderId
            ? { status: "Selected", transactionReference: "" }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actor: viewer.name,
          action: "monthly-winner.selected",
          entityId: campaign.id,
          detail:
            "Selected one founder from this month's Space participants. No payment was made.",
        },
      });
    });
    return json({ state: scopeState(await loadState(), viewer.permissions) });
  } catch (e) {
    return failure(e);
  }
}
