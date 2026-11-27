import "server-only";
import { after } from "next/server";
import type { BookingTelegramNotification, Prisma } from "@prisma/client";
import { bookingTelegramConfiguration } from "@/server/db/booking-telegram";
import { db } from "@/server/db/client";

const london = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "full",
  timeStyle: "medium",
  timeZone: "Europe/London",
  hour12: false,
});

function londonTime(date: Date) {
  return `${london.format(date)} UK time`;
}

function elapsed(start: Date, end: Date) {
  const seconds = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 1000),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours && `${hours}h`, minutes && `${minutes}m`, `${seconds % 60}s`]
    .filter(Boolean)
    .join(" ");
}

function oneLine(value: string) {
  return value.replace(/[\r\n\u0085\u2028\u2029]+/g, " ").trim();
}

function xProfile(handle: string | null) {
  const name = handle?.trim().replace(/^@/, "");
  return name && /^[a-zA-Z0-9_]{1,64}$/.test(name)
    ? `https://x.com/${name}`
    : "Not provided";
}

function website(value: string) {
  try {
    const url = new URL(value);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    // Legacy applications may have no website.
  }
  return "Not provided";
}

const details = {
  booking: {
    select: {
      createdAt: true,
      speakers: true,
      session: { select: { startsAt: true } },
      application: {
        select: {
          founderName: true,
          companyName: true,
          xHandle: true,
          projectXHandle: true,
          website: true,
        },
      },
    },
  },
} satisfies Prisma.BookingTelegramNotificationInclude;

type Notification = Prisma.BookingTelegramNotificationGetPayload<{
  include: typeof details;
}>;
type Stage = "initial" | "approval";

function message(row: Notification, stage: Stage) {
  const { booking } = row;
  const { application } = booking;
  if (stage === "approval") {
    if (!row.approvedAt || !row.approverName || !row.approverRole) return null;
    return [
      "FOUNDERSLAB — BOOKING APPROVED",
      `Founder: ${oneLine(application.founderName)}`,
      `Project: ${oneLine(application.companyName)}`,
      `Approved by: ${oneLine(row.approverName)}`,
      `Role: ${row.approverRole}`,
      `Approved at: ${londonTime(row.approvedAt)}`,
      `Time to approval: ${elapsed(booking.createdAt, row.approvedAt)}`,
      "Status: Approved",
    ].join("\n\n");
  }
  return [
    "FOUNDERSLAB — NEW BOOKING",
    `Founder: ${oneLine(application.founderName)}`,
    `Founder X: ${xProfile(application.xHandle)}`,
    `Project X: ${xProfile(application.projectXHandle)}`,
    `Project website: ${website(application.website)}`,
    `Speakers: ${booking.speakers}`,
    `Requested session: ${londonTime(booking.session.startsAt)}`,
    "Status: Pending approval",
    `Submitted: ${londonTime(booking.createdAt)}`,
  ].join("\n\n");
}

type Delivery =
  | { state: "sent"; messageId: string }
  | { state: "pending"; retryAt: Date }
  | { state: "failed" | "unknown" };

async function send(
  config: NonNullable<ReturnType<typeof bookingTelegramConfiguration>>,
  text: string,
  originalMessageId?: string,
): Promise<Delivery> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          link_preview_options: { is_disabled: true },
          ...(originalMessageId
            ? {
                reply_parameters: {
                  message_id: Number(originalMessageId),
                  allow_sending_without_reply: false,
                },
              }
            : {}),
        }),
        signal: AbortSignal.timeout(4000),
        redirect: "error",
      },
    );
    const data = await response.json().catch(() => null);
    if (
      response.ok &&
      data?.ok === true &&
      Number.isSafeInteger(data.result?.message_id) &&
      data.result.message_id > 0 &&
      String(data.result?.chat?.id) === config.chatId
    )
      return { state: "sent", messageId: String(data.result.message_id) };
    if (response.status === 429 && data?.ok === false) {
      const delay = data.parameters?.retry_after;
      const seconds = Number.isSafeInteger(delay) && delay > 0 ? delay : 60;
      return {
        state: "pending",
        retryAt: new Date(Date.now() + seconds * 1000),
      };
    }
    if (response.status >= 400 && response.status < 500 && data?.ok === false)
      return { state: "failed" };
  } catch {
    // Telegram cannot deduplicate sendMessage after an uncertain response.
  }
  return { state: "unknown" };
}

function due(
  stage: Stage,
  now: Date,
): Prisma.BookingTelegramNotificationWhereInput {
  return stage === "initial"
    ? { initialState: "pending", initialRetryAt: { lte: now } }
    : {
        approvalState: "pending",
        approvalRetryAt: { lte: now },
        originalMessageId: { not: null },
      };
}

async function deliver(
  config: NonNullable<ReturnType<typeof bookingTelegramConfiguration>>,
  row: Notification,
  stage: Stage,
) {
  const text = message(row, stage);
  if (!text) return;
  const model = db().bookingTelegramNotification;
  const claim = await model.updateMany({
    where: {
      bookingId: row.bookingId,
      chatId: config.chatId,
      ...due(stage, new Date()),
    },
    data:
      stage === "initial"
        ? { initialState: "sending" }
        : { approvalState: "sending" },
  });
  if (!claim.count) return;
  const result = await send(
    config,
    text,
    stage === "approval" ? (row.originalMessageId ?? undefined) : undefined,
  );
  const messageId = result.state === "sent" ? result.messageId : null;
  const retryAt = result.state === "pending" ? result.retryAt : null;
  await model.update({
    where: { bookingId: row.bookingId },
    data:
      stage === "initial"
        ? {
            initialState: result.state,
            initialRetryAt: retryAt,
            originalMessageId: messageId,
          }
        : {
            approvalState: result.state,
            approvalRetryAt: retryAt,
            approvalMessageId: messageId,
          },
  });
  if (result.state !== "sent")
    console.warn("[booking-telegram] Delivery", stage, result.state);
}

function readyFor(stage: Stage, row: BookingTelegramNotification, now: Date) {
  return stage === "initial"
    ? row.initialState === "pending" &&
        row.initialRetryAt !== null &&
        row.initialRetryAt <= now
    : row.approvalState === "pending" &&
        row.approvalRetryAt !== null &&
        row.approvalRetryAt <= now &&
        row.originalMessageId !== null;
}

export function scheduleBookingTelegram(bookingIds: string[]) {
  const config = bookingTelegramConfiguration();
  if (!config || !bookingIds.length) return;
  after(async () => {
    try {
      const model = db().bookingTelegramNotification;
      const now = new Date();
      const deferred = await model.findMany({
        where: {
          chatId: config.chatId,
          bookingId: { notIn: bookingIds },
          OR: [due("initial", now), due("approval", now)],
        },
        select: { bookingId: true },
        orderBy: { bookingId: "asc" },
        take: 2,
      });
      await Promise.allSettled(
        [...bookingIds, ...deferred.map((row) => row.bookingId)].map(
          async (bookingId) => {
            try {
              for (const stage of ["initial", "approval"] as const) {
                const row = await model.findUnique({
                  where: { bookingId },
                  include: details,
                });
                if (
                  row?.chatId === config.chatId &&
                  readyFor(stage, row, new Date())
                )
                  await deliver(config, row, stage);
              }
            } catch {
              console.warn(
                "[booking-telegram] Delivery state could not be processed",
              );
            }
          },
        ),
      );
    } catch {
      console.warn("[booking-telegram] Delivery queue could not be read");
    }
  });
}
