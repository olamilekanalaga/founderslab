-- Retain session IDs because bookings, confirmations and assignments already use them.
SELECT pg_advisory_xact_lock(52731913);

WITH upcoming AS (
  SELECT s.id, s."startsAt" AS previous_start,
    (
      ((s."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London')::date + 1 + TIME '19:00')
      AT TIME ZONE 'Europe/London' AT TIME ZONE 'UTC'
    ) AS sunday_start
  FROM "Session" s
  WHERE s.status = 'Scheduled'
    AND s."startsAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    AND EXTRACT(DOW FROM s."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/London') = 6
    AND (
      s.id LIKE 'founders-lab-saturday-%'
      OR EXISTS (SELECT 1 FROM "ProgrammeWeek" w WHERE w."sessionId" = s.id)
    )
)
UPDATE "Session" s
SET "startsAt" = upcoming.sunday_start,
    deadline = s.deadline + (upcoming.sunday_start - upcoming.previous_start),
    timezone = 'Europe/London',
    "updatedAt" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
FROM upcoming
WHERE s.id = upcoming.id
  AND s.status = 'Scheduled'
  AND s."startsAt" = upcoming.previous_start;

UPDATE "ProgrammeSchedule"
SET "anchorDay" = ("anchorDay"::date + 1)::text
WHERE EXTRACT(DOW FROM "anchorDay"::date) = 6;
