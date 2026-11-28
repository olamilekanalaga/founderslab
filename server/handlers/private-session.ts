import "server-only";
import { z } from "zod";
import { businessDiscoverySchema } from "@/lib/business-research";
import { privateSessionRequestSchema } from "@/lib/consultations";
import { DomainError } from "@/lib/domain";
import { rateLimit, requireOrigin } from "@/server/auth";
import { db, hash } from "@/server/db";
import { body, failure, json } from "@/server/http";
import {
  activeAppointment,
  appointmentSelect,
  availableSlots,
} from "@/server/services/consultations";

const inviteToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), token: inviteToken }),
  z.object({
    action: z.literal("reserve"),
    token: inviteToken,
    slotId: z.string().min(1).max(100),
    email: z.email().max(254),
    discovery: businessDiscoverySchema,
  }),
  privateSessionRequestSchema.extend({ action: z.literal("request") }),
]);

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const input = requestSchema.parse(await body(request));
    if (input.action === "request") {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "local";
      await rateLimit(`private-session-request:${ip}`, 10, 60 * 60_000);
      const inboundKey = hash(
        JSON.stringify([
          input.email,
          input.businessName.toLowerCase().replace(/\s+/g, " "),
        ]),
      );
      await db().consultationLead.createMany({
        data: {
          founderName: input.founderName,
          businessName: input.businessName,
          replyEmail: input.email,
          requestContext: input.context,
          source: "Inbound",
          requestedAt: new Date(),
          inboundKey,
        },
        skipDuplicates: true,
      });
      // The same response covers repeated requests without exposing anyone's record.
      return json({ received: true });
    }

    const inviteHash = hash(input.token);
    const lead = await db().consultationLead.findUnique({
      where: { inviteHash },
      select: { id: true },
    });
    if (!lead)
      throw new DomainError(
        "Ask the team for an active private session link.",
        404,
      );
    await rateLimit(`private-session:${inviteHash}`, 60, 60_000);

    if (input.action === "open") {
      const appointment = await db().consultationAppointment.findFirst({
        where: { leadId: lead.id, ...activeAppointment },
        select: appointmentSelect,
      });
      return json({
        appointment,
        slots: appointment ? [] : await availableSlots(),
      });
    }

    const appointment = await db().$transaction(async (tx) => {
      const current = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "ConsultationLead" WHERE id = ${lead.id} AND "inviteHash" = ${inviteHash} FOR UPDATE
      `;
      if (!current.length)
        throw new DomainError(
          "Ask the team for an active private session link.",
          404,
        );
      const existing = await tx.consultationAppointment.findFirst({
        where: { leadId: lead.id, ...activeAppointment },
        select: appointmentSelect,
      });
      if (existing) return existing;
      await tx.$queryRaw`SELECT id FROM "ConsultationSlot" WHERE id = ${input.slotId} FOR UPDATE`;
      const slot = await tx.consultationSlot.findFirst({
        where: {
          id: input.slotId,
          startsAt: { gt: new Date() },
          withdrawnAt: null,
          appointments: { none: activeAppointment },
        },
        select: { id: true },
      });
      if (!slot)
        throw new DomainError(
          "That appointment is no longer available. Refresh the available times to choose another.",
          409,
        );
      return tx.consultationAppointment.create({
        data: {
          leadId: lead.id,
          slotId: slot.id,
          email: input.email,
          discovery: input.discovery,
        },
        select: appointmentSelect,
      });
    });
    return json({ appointment });
  } catch (error) {
    return failure(error);
  }
}
