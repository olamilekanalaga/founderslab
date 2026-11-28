import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  clinicSettings,
  consultationSettingsKey,
  engagementSchema,
  followUpSchema,
  followUpStatuses,
  stageLabels,
  type PipelineStage,
} from "@/lib/consultations";
import { DomainError } from "@/lib/domain";
import { requireCsrf } from "@/server/auth";
import { requireWorkspaceViewer } from "@/server/auth/workspace";
import { db, hash, token } from "@/server/db";
import { body, failure, json } from "@/server/http";
import {
  activeAppointment,
  lockAppointment,
  readClinicSettings,
} from "@/server/services/consultations";
import {
  checkoutEnabled,
  checkoutExpiry,
  expireCheckout,
} from "@/server/services/consultation-payments";
import { researchQueueEligible } from "@/server/services/business-research";

const id = z.string().min(1).max(100);
const name = z.string().trim().min(1).max(180);
const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), settings: clinicSettings }),
  z.object({ action: z.literal("add-slot"), startsAt: z.iso.datetime() }),
  z.object({ action: z.literal("withdraw-slot"), slotId: id }),
  z.object({
    action: z.literal("new-lead"),
    founderName: name,
    businessName: name,
  }),
  z.object({ action: z.literal("issue-link"), leadId: id }),
  z.object({ action: z.literal("issue-space-link"), applicationId: id }),
  z.object({
    action: z.literal("save-follow-up"),
    applicationId: id,
    followUp: followUpSchema,
    status: z.enum(followUpStatuses),
    version: z.number().int().nonnegative(),
  }),
  z.object({
    action: z.literal("appointment"),
    appointmentId: id,
    status: z.enum(["record-payment", "complete", "cancel"]),
  }),
  z.object({
    action: z.literal("engagement"),
    leadId: id,
    engagementId: id.optional(),
    engagement: engagementSchema,
  }),
]);

async function operator(write?: Request) {
  const viewer = await requireWorkspaceViewer();
  if (
    !viewer.permissions.includes("commercial.read") ||
    (write && !viewer.permissions.includes("commercial.write"))
  )
    throw new DomainError("Permission required.", 403);
  if (write) requireCsrf(write, viewer);
  return viewer;
}

const pipelineLead = {
  id: true,
  applicationId: true,
  founderName: true,
  businessName: true,
  offeredAt: true,
  followUpStatus: true,
  consultations: {
    where: activeAppointment,
    select: { bookingStatus: true, paymentStatus: true, paidAt: true },
  },
  engagements: {
    select: {
      discussionAt: true,
      proposalAt: true,
      securedAt: true,
      closedAt: true,
    },
  },
} as const;

const programmeSelect = {
  id: true,
  founderName: true,
  companyName: true,
  founderId: true,
  companyId: true,
  bookings: {
    where: { status: { in: ["Approved", "Attended", "No-show"] } },
    select: {
      id: true,
      status: true,
      session: {
        select: {
          startsAt: true,
          spaceData: { select: { submittedAt: true, founderBookingIds: true } },
          participants: {
            where: { attendance: "Attended" },
            select: { founderId: true, companyId: true },
          },
        },
      },
    },
  },
  businessResearch: { select: { status: true } },
  consultationLead: { select: pipelineLead },
} satisfies Prisma.ApplicationSelect;

function milestones(
  lead: {
    offeredAt: Date | null;
    followUpStatus: string;
    consultations: { bookingStatus: string; paymentStatus: string }[];
    engagements: {
      discussionAt: Date | null;
      proposalAt: Date | null;
      securedAt: Date | null;
      closedAt: Date | null;
    }[];
  } | null,
  spaceBooked: boolean,
  spaceCompleted: boolean,
) {
  const stages = new Set<PipelineStage>();
  if (spaceBooked) stages.add("Space booked");
  if (spaceCompleted) stages.add("Space completed");
  if (lead) {
    if (
      [
        "Opportunity identified",
        "Private session offered",
        "Follow-up sent",
      ].includes(lead.followUpStatus)
    )
      stages.add("Business opportunity identified");
    if (lead.offeredAt) stages.add("Private session offered");
    if (lead.consultations.length) stages.add("Private session booked");
    if (
      lead.consultations.some(({ paymentStatus }) => paymentStatus === "Paid")
    )
      stages.add("Payment received");
    if (
      lead.consultations.some(
        ({ bookingStatus }) => bookingStatus === "Completed",
      )
    )
      stages.add("Private session completed");
    if (lead.engagements.some(({ discussionAt }) => discussionAt))
      stages.add("Commercial discussion");
    if (lead.engagements.some(({ proposalAt }) => proposalAt))
      stages.add("Proposal submitted");
    if (lead.engagements.some(({ securedAt }) => securedAt))
      stages.add("Hired or contract secured");
    if (lead.engagements.some(({ closedAt }) => closedAt))
      stages.add("Declined or closed");
    if (lead.followUpStatus === "Declined or closed")
      stages.add("Declined or closed");
  }
  return stageLabels.filter((stage) => stages.has(stage));
}

export async function GET(request: Request) {
  try {
    await operator();
    const params = new URL(request.url).searchParams;
    const applicationId = params.get("application");
    if (applicationId) {
      const lead = await db().consultationLead.findUnique({
        where: { applicationId },
        select: {
          id: true,
          followUp: true,
          followUpStatus: true,
          followUpVersion: true,
          offeredAt: true,
        },
      });
      return json({ lead });
    }
    const leadId = params.get("lead");
    if (leadId) {
      const lead = await db().consultationLead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          founderName: true,
          businessName: true,
          applicationId: true,
          offeredAt: true,
          consultations: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              bookingStatus: true,
              paymentStatus: true,
              feePence: true,
              paidAt: true,
              email: true,
              discovery: true,
              checkoutStartedAt: true,
              slot: { select: { startsAt: true, endsAt: true } },
            },
          },
          engagements: { orderBy: { createdAt: "desc" } },
        },
      });
      if (!lead) throw new DomainError("Business record not found.", 404);
      return json({ lead, checkout: checkoutEnabled() });
    }
    const [settings, slots, applications, independent] = await Promise.all([
      readClinicSettings(),
      db().consultationSlot.findMany({
        where: { startsAt: { gt: new Date() }, withdrawnAt: null },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          _count: { select: { appointments: { where: activeAppointment } } },
        },
      }),
      db().application.findMany({
        where: {
          OR: [
            {
              bookings: {
                some: { status: { in: ["Approved", "Attended", "No-show"] } },
              },
            },
            { consultationLead: { isNot: null } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: programmeSelect,
      }),
      db().consultationLead.findMany({
        where: { applicationId: null },
        orderBy: { createdAt: "desc" },
        select: pipelineLead,
      }),
    ]);
    const conversions = {
      publicParticipants: 0,
      paidAfterSpace: 0,
      securedAfterConsultation: 0,
    };
    const rows = [
      ...applications.map((app) => {
        const completed = app.bookings.filter(
          (booking) =>
            booking.status === "Attended" ||
            Boolean(
              booking.session.spaceData?.submittedAt &&
              booking.session.spaceData.founderBookingIds.includes(booking.id),
            ) ||
            booking.session.participants.some(
              ({ founderId, companyId }) =>
                founderId === app.founderId && companyId === app.companyId,
            ),
        );
        if (completed.length) {
          conversions.publicParticipants++;
          const firstSpace = Math.min(
            ...completed.map(({ session }) => session.startsAt.getTime()),
          );
          const paid = app.consultationLead?.consultations.find(
            ({ paidAt }) => paidAt && paidAt.getTime() >= firstSpace,
          );
          if (paid?.paidAt) {
            conversions.paidAfterSpace++;
            const payment = paid.paidAt;
            if (
              app.consultationLead?.engagements.some(
                ({ securedAt }) => securedAt && securedAt >= payment,
              )
            )
              conversions.securedAfterConsultation++;
          }
        }
        return {
          id: app.consultationLead?.id ?? null,
          applicationId: app.id,
          businessName: app.companyName,
          founderName: app.founderName,
          researchStatus: app.businessResearch?.status ?? "Pending",
          stages: milestones(
            app.consultationLead,
            Boolean(app.bookings.length),
            Boolean(completed.length),
          ),
        };
      }),
      ...independent.map((lead) => ({
        id: lead.id,
        applicationId: null,
        businessName: lead.businessName,
        founderName: lead.founderName,
        researchStatus: null,
        stages: milestones(lead, false, false),
      })),
    ];
    const totals = stageLabels.map((stage) => ({
      stage,
      count: rows.filter((row) => row.stages.includes(stage)).length,
    }));
    return json({
      rows,
      totals,
      conversions,
      settings,
      slots,
      checkout: checkoutEnabled(),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await operator(request);
    const input = command.parse(await body(request));
    const result = await db().$transaction(
      async (tx) => {
        if (input.action === "settings") {
          await tx.setting.upsert({
            where: { key: consultationSettingsKey },
            create: { key: consultationSettingsKey, value: input.settings },
            update: { value: input.settings },
          });
          return { id: consultationSettingsKey };
        }
        if (input.action === "add-slot") {
          await tx.$queryRaw`SELECT key FROM "Setting" WHERE key = ${consultationSettingsKey} FOR UPDATE`;
          const settings = await readClinicSettings(tx);
          if (!settings)
            throw new DomainError(
              "Set the fee and duration before adding appointments.",
              409,
            );
          const startsAt = new Date(input.startsAt);
          if (startsAt <= new Date())
            throw new DomainError("Choose a time in the future.");
          const endsAt = new Date(
            startsAt.getTime() + settings.durationMinutes * 60_000,
          );
          if (
            await tx.consultationSlot.findFirst({
              where: {
                withdrawnAt: null,
                startsAt: { lt: endsAt },
                endsAt: { gt: startsAt },
              },
              select: { id: true },
            })
          )
            throw new DomainError(
              "This appointment overlaps another slot.",
              409,
            );
          return tx.consultationSlot.create({
            data: { startsAt, endsAt },
            select: { id: true },
          });
        }
        if (input.action === "withdraw-slot") {
          await tx.$queryRaw`SELECT id FROM "ConsultationSlot" WHERE id = ${input.slotId} FOR UPDATE`;
          const changed = await tx.consultationSlot.updateMany({
            where: {
              id: input.slotId,
              appointments: { none: activeAppointment },
            },
            data: { withdrawnAt: new Date() },
          });
          if (!changed.count)
            throw new DomainError(
              "Only unbooked appointments can be removed.",
              409,
            );
          return { id: input.slotId };
        }
        if (input.action === "new-lead") {
          return tx.consultationLead.create({
            data: {
              founderName: input.founderName,
              businessName: input.businessName,
            },
            select: { id: true },
          });
        }
        if (input.action === "appointment") {
          const appointment = await lockAppointment(tx, input.appointmentId);
          if (!appointment)
            throw new DomainError("Appointment not found.", 404);
          const now = new Date();
          let data;
          if (input.status === "record-payment") {
            if (appointment.paymentStatus === "Paid")
              return { id: appointment.id };
            if (
              appointment.bookingStatus !== "Reserved" ||
              checkoutEnabled() ||
              appointment.checkoutStartedAt
            )
              throw new DomainError(
                "Manual payment recording is available only for open offline reservations.",
                409,
              );
            data = {
              paymentStatus: "Paid",
              bookingStatus: "Confirmed",
              paidAt: now,
            };
          } else if (input.status === "complete") {
            if (appointment.bookingStatus === "Completed")
              return { id: appointment.id };
            if (
              appointment.bookingStatus !== "Confirmed" ||
              appointment.slot.endsAt > now
            )
              throw new DomainError(
                "Complete the session after the confirmed appointment has ended.",
                409,
              );
            data = { bookingStatus: "Completed", completedAt: now };
          } else {
            if (appointment.bookingStatus === "Cancelled")
              return { id: appointment.id };
            if (appointment.bookingStatus !== "Reserved")
              throw new DomainError(
                "Only unpaid reservations can be cancelled here.",
                409,
              );
            if (appointment.stripeSessionId)
              await expireCheckout(appointment.stripeSessionId);
            else if (
              appointment.checkoutStartedAt &&
              checkoutExpiry(
                appointment.slot.startsAt,
                appointment.checkoutStartedAt,
              ) >= now.getTime()
            )
              throw new DomainError(
                "Checkout may still be open. Try after it expires.",
                409,
              );
            data = { bookingStatus: "Cancelled" };
          }
          return tx.consultationAppointment.update({
            where: { id: appointment.id },
            data,
            select: { id: true },
          });
        }
        if (input.action === "engagement") {
          const lead = await tx.consultationLead.findUnique({
            where: { id: input.leadId },
            select: {
              consultations: {
                where: { bookingStatus: "Completed" },
                take: 1,
                select: { id: true },
              },
            },
          });
          if (!lead?.consultations.length)
            throw new DomainError(
              "Record the completed private session before adding an engagement.",
              409,
            );
          const { followUpOn, ...values } = input.engagement;
          const data = {
            ...values,
            followUpOn: followUpOn ? new Date(followUpOn) : null,
          };
          const milestone = {
            "Commercial discussion": "discussionAt",
            "Proposal submitted": "proposalAt",
            "Hired or contract secured": "securedAt",
            "Declined or closed": "closedAt",
          } as const;
          const reached = milestone[values.status];
          const now = new Date();
          if (input.engagementId) {
            await tx.$queryRaw`SELECT id FROM "CommercialEngagement" WHERE id = ${input.engagementId} AND "leadId" = ${input.leadId} FOR UPDATE`;
            const record = await tx.commercialEngagement.findUnique({
              where: { id: input.engagementId, leadId: input.leadId },
            });
            if (!record) throw new DomainError("Engagement not found.", 404);
            return tx.commercialEngagement.update({
              where: { id: record.id },
              data: { ...data, [reached]: record[reached] ?? now },
              select: { id: true },
            });
          }
          return tx.commercialEngagement.create({
            data: { leadId: input.leadId, ...data, [reached]: now },
            select: { id: true },
          });
        }
        let leadId: string;
        if (input.action === "issue-link") {
          leadId = input.leadId;
        } else {
          const application = await tx.application.findFirst({
            where: { ...researchQueueEligible, id: input.applicationId },
            select: { id: true, founderName: true, companyName: true },
          });
          if (!application || !viewer.permissions.includes("research.read"))
            throw new DomainError("Research workspace not found.", 404);
          const lead = await tx.consultationLead.upsert({
            where: { applicationId: application.id },
            create: {
              applicationId: application.id,
              founderName: application.founderName,
              businessName: application.companyName,
            },
            update: {},
            select: { id: true },
          });
          leadId = lead.id;
        }
        if (input.action === "save-follow-up") {
          const changed = await tx.consultationLead.updateMany({
            where: { id: leadId, followUpVersion: input.version },
            data: {
              followUp: input.followUp,
              followUpStatus: input.status,
              followUpVersion: { increment: 1 },
            },
          });
          if (!changed.count)
            throw new DomainError(
              "Someone else saved these notes. Reopen the workspace.",
              409,
            );
          return { id: leadId, version: input.version + 1 };
        }
        const raw = token();
        const lead = await tx.consultationLead.update({
          where: { id: leadId },
          data: { inviteHash: hash(raw), offeredAt: new Date() },
          select: { id: true },
        });
        return { ...lead, token: raw };
      },
      { timeout: 12_000 },
    );
    await db()
      .auditLog.create({
        data: {
          actor: viewer.name,
          action: "commercial." + input.action,
          entityId: result.id,
          detail: input.action === "appointment" ? input.status : "",
        },
      })
      .catch(() =>
        console.error("Could not write the commercial audit event."),
      );
    return json(result);
  } catch (error) {
    return failure(error);
  }
}
