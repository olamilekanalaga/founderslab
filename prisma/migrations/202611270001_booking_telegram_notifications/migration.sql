CREATE TABLE "BookingTelegramNotification" (
    "bookingId" TEXT NOT NULL,
    "chatId" TEXT,
    "originalMessageId" TEXT,
    "approvalMessageId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approverId" TEXT,
    "approverName" TEXT,
    "approverRole" TEXT,
    "initialState" TEXT NOT NULL DEFAULT 'pending',
    "initialRetryAt" TIMESTAMP(3),
    "approvalState" TEXT NOT NULL DEFAULT 'pending',
    "approvalRetryAt" TIMESTAMP(3),

    CONSTRAINT "BookingTelegramNotification_pkey" PRIMARY KEY ("bookingId"),
    CONSTRAINT "BookingTelegramNotification_bookingId_fkey"
        FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "booking_telegram_chat_message_key"
    ON "BookingTelegramNotification"("chatId", "originalMessageId");
CREATE INDEX "booking_telegram_initial_due_idx"
    ON "BookingTelegramNotification"("chatId", "initialState", "initialRetryAt");
CREATE INDEX "booking_telegram_approval_due_idx"
    ON "BookingTelegramNotification"("chatId", "approvalState", "approvalRetryAt");
