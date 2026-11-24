import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/domain";

export async function approveSpaceReferrals(
  tx: Prisma.TransactionClient,
  sessionId: string,
  actor: string,
) {
  await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId} FOR UPDATE`;
  const session = await tx.session.findUnique({
    where: { id: sessionId },
    include: { spaceData: true },
  });
  if (
    !session ||
    session.status !== "Completed" ||
    session.startsAt >= new Date() ||
    !session.spaceData?.submittedAt
  )
    throw new DomainError(
      "Complete the Space and submit its attendance before final approval.",
      409,
    );

  const where = {
    id: { in: session.spaceData.founderBookingIds },
    sessionId,
    status: { in: ["Approved", "Attended"] },
    application: {
      status: "Approved",
      founderId: { not: null },
      companyId: { not: null },
      bdPartnerId: { not: null },
    },
  };
  const candidates = await tx.bookingRequest.findMany({
    where,
    select: { application: { select: { bdPartnerId: true } } },
  });
  // Serialize against partner payments, disqualifications, and other Space approvals.
  for (const partnerId of [
    ...new Set(candidates.map(({ application }) => application.bdPartnerId!)),
  ].sort())
    await tx.$queryRaw`SELECT id FROM "BdPartner" WHERE id = ${partnerId} FOR UPDATE`;

  const bookings = await tx.bookingRequest.findMany({
    where,
    include: { application: { include: { bdPartner: true } } },
    orderBy: { id: "asc" },
  });
  const competing = new Map<string, number>();
  for (const booking of bookings) {
    const { companyId, bdReviewStatus } = booking.application;
    if (
      companyId &&
      !["self", "host", "disqualified"].includes(bdReviewStatus || "")
    )
      competing.set(companyId, (competing.get(companyId) ?? 0) + 1);
  }

  let credited = 0,
    excluded = 0;
  for (const booking of bookings) {
    const app = booking.application;
    const partner = app.bdPartner;
    if (!app.companyId || !partner) continue;
    const prior = await tx.bdAppearance.findUnique({
      where: { sessionId_companyId: { sessionId, companyId: app.companyId } },
    });
    if (prior && !prior.reversedAt) continue;
    const emailMatch = Boolean(
      app.contact && app.contact.toLowerCase() === partner.email.toLowerCase(),
    );
    const handleMatch = partner.name.toLowerCase() === `@${app.xHandle}`;
    const ownerEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const hostHandle = session.host.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const hostAppearance = Boolean(
      (ownerEmail && app.contact.toLowerCase() === ownerEmail) ||
      (hostHandle && app.xHandle === hostHandle),
    );

    const matchAnotherFounder =
      app.projectXHandle &&
      app.bdReviewStatus !== "cleared" &&
      (await tx.application.findFirst({
        where: {
          id: { not: app.id },
          status: "Approved",
          projectXHandle: app.projectXHandle,
          xHandle: { not: app.xHandle },
        },
        select: { id: true },
      }));
    const flag = hostAppearance
      ? "host"
      : emailMatch
        ? "self"
        : (app.bdReviewStatus ??
          (handleMatch ||
          matchAnotherFounder ||
          competing.get(app.companyId)! > 1
            ? "review"
            : null));
    if (flag && flag !== "cleared") {
      excluded++;
      if (flag !== app.bdReviewStatus) {
        await tx.application.update({
          where: { id: app.id },
          data: { bdReviewStatus: flag },
        });
        await tx.auditLog.create({
          data: {
            actor,
            action: "bd.review.flag",
            entityId: app.id,
            detail: hostAppearance
              ? "The founder matches the Space host."
              : emailMatch
                ? "Contact email matches BD account."
                : "Conflicting founder identity or project attribution.",
          },
        });
      }
      continue;
    }
    if (
      prior &&
      (prior.bookingId !== booking.id || prior.partnerId !== partner.id)
    ) {
      excluded++;
      continue;
    }
    const latest = await tx.bdAppearance.aggregate({
      where: { partnerId: partner.id },
      _max: { ordinal: true },
    });
    const appearance = prior
      ? await tx.bdAppearance.update({
          where: { id: prior.id },
          data: { reversedAt: null, verifiedAt: new Date() },
        })
      : await tx.bdAppearance.create({
          data: {
            id: randomUUID(),
            partnerId: partner.id,
            bookingId: booking.id,
            sessionId,
            companyId: app.companyId,
            ordinal: (latest._max.ordinal ?? 0) + 1,
          },
        });
    await tx.auditLog.create({
      data: {
        actor,
        action: "bd.verify",
        entityId: appearance.id,
        detail: "Owner approved attendance in the completed Space.",
      },
    });
    credited++;
  }
  await tx.spaceData.update({
    where: { sessionId },
    data: { bdApprovedAt: new Date() },
  });
  await tx.auditLog.create({
    data: {
      actor,
      action: "bd.space.approve",
      entityId: sessionId,
      detail: `${credited} newly verified; ${excluded} excluded by referral review or duplicate credit.`,
    },
  });
  return { credited, excluded };
}
