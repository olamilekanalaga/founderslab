ALTER TABLE "Application" ADD COLUMN "bdReviewStatus" TEXT;
ALTER TABLE "SpaceData" ADD COLUMN "bdApprovedAt" TIMESTAMP(3);
ALTER TABLE "SpaceData" ADD COLUMN "founderBookingIds" TEXT[] NOT NULL DEFAULT '{}';
-- Preserve attendance for appearances already verified under the earlier workflow.
UPDATE "SpaceData" AS report
SET "founderBookingIds" = historical.bookings
FROM (
  SELECT appearance."sessionId", array_agg(appearance."bookingId" ORDER BY appearance."bookingId") AS bookings
  FROM "BdAppearance" AS appearance
  JOIN "BookingRequest" AS booking ON booking.id = appearance."bookingId"
  WHERE appearance."reversedAt" IS NULL AND booking."sessionId" = appearance."sessionId"
  GROUP BY appearance."sessionId"
) AS historical
WHERE report."sessionId" = historical."sessionId";
