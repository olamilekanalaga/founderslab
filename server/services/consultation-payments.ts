import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/domain";
import { consultationPath } from "@/lib/consultations";

export function checkoutEnabled() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET,
  );
}

// Stripe requires a newly created Checkout session to remain open for at least 30 minutes.
const minimumCheckoutWindowMs = 31 * 60_000;
export function firstBookableTime(now = new Date()) {
  return checkoutEnabled()
    ? new Date(now.getTime() + minimumCheckoutWindowMs)
    : now;
}

export function checkoutExpiry(slotStart: Date, initiated: Date) {
  return Math.min(slotStart.getTime(), initiated.getTime() + 60 * 60_000);
}

const checkoutSession = z.object({
  id: z.string(),
  status: z.string(),
  url: z.url().nullable(),
});

async function stripeRequest(
  path: string,
  fields?: URLSearchParams,
  key?: string,
) {
  if (!checkoutEnabled())
    throw new DomainError("Online payment is unavailable.", 503);
  try {
    const headers: Record<string, string> = {
      Authorization: "Bearer " + process.env.STRIPE_SECRET_KEY,
    };
    if (key) headers["Idempotency-Key"] = key;
    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions" + path,
      {
        method: fields ? "POST" : "GET",
        headers,
        body: fields,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.ok) return checkoutSession.parse(await response.json());
  } catch {
    // Leave the reservation intact for a retry with the same checkout key.
  }
  throw new DomainError(
    "Payment service is unavailable. The reservation is still on hold.",
    503,
  );
}

export async function startCheckout(appointment: {
  id: string;
  feePence: number;
  expiresAt: number;
  checkoutOrigin: string;
}) {
  const returnUrl = new URL(
    consultationPath + "?checkout=return",
    appointment.checkoutOrigin,
  ).href;
  const session = await stripeRequest(
    "",
    new URLSearchParams({
      mode: "payment",
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": "gbp",
      "line_items[0][price_data][unit_amount]": String(appointment.feePence),
      "line_items[0][price_data][product_data][name]":
        "Founders Lab Private Business Session",
      "line_items[0][quantity]": "1",
      "metadata[appointmentId]": appointment.id,
      expires_at: String(Math.floor(appointment.expiresAt / 1000)),
      success_url: returnUrl,
      cancel_url: returnUrl,
    }),
    `consultation-${appointment.id}`,
  );
  if (
    session.status !== "open" ||
    !session.url ||
    new URL(session.url).hostname !== "checkout.stripe.com"
  )
    throw new DomainError(
      "This checkout is closed. Reopen the booking link for the latest status.",
      409,
    );
  return { id: session.id, url: session.url };
}

export async function expireCheckout(id: string) {
  const path = "/" + encodeURIComponent(id);
  const session = await stripeRequest(path);
  if (session.status === "expired") return;
  if (
    session.status !== "open" ||
    (await stripeRequest(path + "/expire", new URLSearchParams())).status !==
      "expired"
  )
    throw new DomainError(
      "Checkout could not be cancelled. Check payment status first.",
      409,
    );
}

const eventSchema = z.object({
  type: z.string(),
  data: z.object({ object: z.unknown() }),
});
export const appointmentEvent = z.object({
  id: z.string(),
  metadata: z.object({ appointmentId: z.string() }),
  payment_status: z.string(),
  status: z.string(),
  amount_total: z.number().int(),
  currency: z.string(),
});

export function verifiedStripeEvent(raw: string, header: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const values = new URLSearchParams(header.replaceAll(",", "&"));
  const timestamp = values.get("t") || "";
  if (
    !secret ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    throw new DomainError("Invalid Stripe signature.", 400);
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest();
  if (
    !values
      .getAll("v1")
      .some(
        (candidate) =>
          /^[a-f0-9]{64}$/i.test(candidate) &&
          timingSafeEqual(digest, Buffer.from(candidate, "hex")),
      )
  )
    throw new DomainError("Invalid Stripe signature.", 400);
  return eventSchema.parse(JSON.parse(raw));
}
