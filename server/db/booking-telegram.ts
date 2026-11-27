import type { Prisma } from "@prisma/client";
import type { Viewer } from "@/lib/types";

export function bookingTelegramConfiguration() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return token &&
    /^\d+:[A-Za-z0-9_-]+$/.test(token) &&
    chatId &&
    /^-\d+$/.test(chatId)
    ? { token, chatId }
    : null;
}

export async function trackFounderBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
) {
  const chatId = bookingTelegramConfiguration()?.chatId;
  await tx.bookingTelegramNotification.create({
    data: { bookingId, chatId, initialRetryAt: chatId ? new Date() : null },
  });
}

export async function trackBookingApproval(
  tx: Prisma.TransactionClient,
  bookingId: string,
  approvedAt: string,
  viewer: Viewer,
) {
  return tx.bookingTelegramNotification.updateMany({
    where: { bookingId, approvedAt: null },
    data: {
      approvedAt,
      approverId: viewer.id,
      approverName: viewer.name.trim() || `Staff ID ${viewer.id}`,
      approverRole:
        viewer.roleId === "space-manager" ? "Space Manager" : "Admin",
      approvalRetryAt: new Date(),
    },
  });
}
