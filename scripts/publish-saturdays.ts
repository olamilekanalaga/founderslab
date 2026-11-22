/** Publish the approved schedule without resetting bookings or reopening cancellations. */
export {};
try {
  process.loadEnvFile(".env");
} catch {}
const { db } = await import("../lib/db");
const { saturdaySessions } = await import("../lib/saturday-schedule");
const candidates = saturdaySessions();
const result = await db().$transaction(
  async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(52731913)`;
    const existing = await tx.session.findMany({
      where: {
        startsAt: {
          gte: new Date(
            candidates[0].startsAt.toISOString().slice(0, 10) + "T00:00:00Z",
          ),
          lt: new Date(candidates.at(-1)!.startsAt.getTime() + 86400000),
        },
      },
      select: { id: true, startsAt: true },
    });
    const dates = new Set(
      existing.map((s) => s.startsAt.toISOString().slice(0, 10)),
    );
    return tx.session.createMany({
      data: candidates.filter(
        (s) => !dates.has(s.startsAt.toISOString().slice(0, 10)),
      ),
      skipDuplicates: true,
    });
  },
  { timeout: 30000 },
);
console.log(
  `Published ${result.count} new Saturday sessions at 19:00 UTC, five project places each. Existing sessions and bookings were preserved.`,
);
await db().$disconnect();
// On the hosted release, verify that the existing public calendar API sees new slots.
// No credentials or private founder records are sent or returned by this check.
if (
  result.count > 0 &&
  process.env.VERCEL === "1" &&
  process.env.VERCEL_ENV === "production"
) {
  const response = await fetch(
    `https://founderslab-orcin.vercel.app/api/public/sessions?schedule_check=${Date.now()}`,
    { cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok)
    throw new Error(
      "Published sessions could not be verified through the public booking API.",
    );
  const data = (await response.json()) as {
    sessions?: {
      id: string;
      startsAt: string;
      capacity: number;
      availableSeats: number;
    }[];
  };
  const available = (data.sessions || []).filter(
    (s) =>
      s.id.startsWith("founders-lab-saturday-") &&
      new Date(s.startsAt).getUTCDay() === 6 &&
      new Date(s.startsAt).getUTCHours() === 19 &&
      s.capacity === 5 &&
      s.availableSeats > 0,
  );
  if (!available.length)
    throw new Error(
      "The public booking API did not return the newly published Saturday places.",
    );
  console.log(
    `Verified ${available.length} available 19:00 UTC Saturdays through the live public booking API.`,
  );
}
