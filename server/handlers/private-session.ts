import "server-only";
import { z } from "zod";
import { businessDiscoverySchema } from "@/lib/business-research";
import { DomainError } from "@/lib/domain";
import { consultationSettingsKey } from "@/lib/consultations";
import { rateLimit, requireOrigin } from "@/server/auth";
import { db, hash } from "@/server/db";
import { body, failure, json } from "@/server/http";
import {
  activeAppointment,
  appointmentSelect,
  availableSlots,
  lockAppointment,
  readClinicSettings,
} from "@/server/services/consultations";
import {
  appointmentEvent,
  checkoutEnabled,
  checkoutExpiry,
  firstBookableTime,
  startCheckout,
  verifiedStripeEvent,
} from "@/server/services/consultation-payments";

const inviteToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), token: inviteToken }),
  z.object({
    action: z.literal("reserve"),
    token: inviteToken,
    slotId: z.string().min(1).max(100),
    email: z.email().max(254),
    feePence: z.number().int().positive(),
    discovery: businessDiscoverySchema,
  }),
  z.object({ action: z.literal("checkout"), token: inviteToken }),
]);

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const input = requestSchema.parse(await body(request));
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
      const [settings, appointments, slots] = await Promise.all([
        readClinicSettings(),
        db().consultationAppointment.findMany({
          where: { leadId: lead.id, ...activeAppointment },
          orderBy: { createdAt: "desc" },
          select: appointmentSelect,
          take: 1,
        }),
        availableSlots(),
      ]);
      return json({
        settings,
        appointment: appointments[0] ?? null,
        slots,
        checkout: checkoutEnabled(),
      });
    }
    if (input.action === "reserve") {
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
        await tx.$queryRaw`SELECT key FROM "Setting" WHERE key = ${consultationSettingsKey} FOR SHARE`;
        const settings = await readClinicSettings(tx);
        if (!settings || settings.feePence !== input.feePence)
          throw new DomainError(
            "The fee has changed. Reopen the link to review it.",
            409,
          );
        await tx.$queryRaw`SELECT id FROM "ConsultationSlot" WHERE id = ${input.slotId} FOR UPDATE`;
        const slot = await tx.consultationSlot.findFirst({
          where: {
            id: input.slotId,
            startsAt: { gt: firstBookableTime() },
            withdrawnAt: null,
            appointments: { none: activeAppointment },
          },
        });
        if (!slot)
          throw new DomainError(
            "That appointment is no longer available. Reopen the link to choose another time.",
            409,
          );
        return tx.consultationAppointment.create({
          data: {
            leadId: lead.id,
            slotId: slot.id,
            email: input.email,
            discovery: input.discovery,
            feePence: settings.feePence,
          },
          select: appointmentSelect,
        });
      });
      return json({ appointment, checkout: checkoutEnabled() });
    }

    if (!checkoutEnabled())
      throw new DomainError("Online payment is unavailable.", 503);
    const id = await db().$transaction(async (tx) => {
      const appointment = await tx.consultationAppointment.findFirst({
        where: {
          lead: { id: lead.id, inviteHash },
          bookingStatus: "Reserved",
          paymentStatus: "Unpaid",
        },
        select: { id: true },
      });
      const current =
        appointment && (await lockAppointment(tx, appointment.id));
      if (
        !current ||
        current.bookingStatus !== "Reserved" ||
        current.slot.startsAt <= new Date()
      )
        throw new DomainError(
          "There is no active reservation awaiting payment.",
          409,
        );
      if (!current.checkoutStartedAt) {
        if (current.slot.startsAt <= firstBookableTime())
          throw new DomainError(
            "This appointment is too soon for online checkout. Contact the team.",
            409,
          );
        await tx.consultationAppointment.update({
          where: { id: current.id },
          data: {
            checkoutStartedAt: new Date(),
            checkoutOrigin: request.headers.get("origin")!,
          },
        });
      }
      return current.id;
    });
    const checkout = await db().$transaction(
      async (tx) => {
        const leadRows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "ConsultationLead" WHERE id = ${lead.id} AND "inviteHash" = ${inviteHash} FOR SHARE
      `;
        if (!leadRows.length)
          throw new DomainError(
            "Ask the team for an active private session link.",
            404,
          );
        const appointment = await lockAppointment(tx, id);
        if (
          appointment?.bookingStatus !== "Reserved" ||
          !appointment.checkoutStartedAt ||
          !appointment.checkoutOrigin
        )
          throw new DomainError(
            "There is no active reservation awaiting payment.",
            409,
          );
        const expiresAt = checkoutExpiry(
          appointment.slot.startsAt,
          appointment.checkoutStartedAt,
        );
        if (expiresAt <= Date.now())
          throw new DomainError(
            "Checkout expired. Ask the team to reopen your appointment.",
            409,
          );
        const session = await startCheckout({
          id,
          feePence: appointment.feePence,
          expiresAt,
          checkoutOrigin: appointment.checkoutOrigin,
        });
        await tx.consultationAppointment.update({
          where: { id },
          data: { stripeSessionId: session.id },
        });
        return session.url;
      },
      { timeout: 12_000 },
    );
    return json({ checkout });
  } catch (error) {
    return failure(error);
  }
}

export async function stripeWebhook(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 250_000) throw new DomainError("Request too large.", 413);
    const event = verifiedStripeEvent(
      raw,
      request.headers.get("stripe-signature") || "",
    );
    if (
      !["checkout.session.completed", "checkout.session.expired"].includes(
        event.type,
      )
    )
      return json({ received: true });
    const parsed = appointmentEvent.safeParse(event.data.object);
    if (!parsed.success) return json({ received: true });
    const session = parsed.data;
    await db().$transaction(async (tx) => {
      const appointment = await lockAppointment(
        tx,
        session.metadata.appointmentId,
      );
      if (
        !appointment?.checkoutStartedAt ||
        (appointment.stripeSessionId &&
          appointment.stripeSessionId !== session.id) ||
        appointment.feePence !== session.amount_total ||
        session.currency !== "gbp" ||
        appointment.bookingStatus !== "Reserved" ||
        appointment.paymentStatus !== "Unpaid"
      )
        return;
      if (
        event.type === "checkout.session.completed" &&
        session.status === "complete" &&
        session.payment_status === "paid"
      ) {
        await tx.consultationAppointment.update({
          where: { id: appointment.id },
          data: {
            bookingStatus: "Confirmed",
            paymentStatus: "Paid",
            stripeSessionId: session.id,
            paidAt: new Date(),
          },
        });
      } else if (
        event.type === "checkout.session.expired" &&
        session.status === "expired" &&
        session.payment_status === "unpaid"
      ) {
        await tx.consultationAppointment.update({
          where: { id: appointment.id },
          data: { bookingStatus: "Cancelled", stripeSessionId: session.id },
        });
      }
    });
    return json({ received: true });
  } catch (error) {
    return failure(error);
  }
}
