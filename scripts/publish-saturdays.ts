/** Publish the approved schedule without resetting bookings or reopening cancellations. */
export {};
try {
  process.loadEnvFile(".env");
} catch {}
const { db } = await import("../lib/db");
const { saturdaySessions, saturdaySchedulePlan, isLondonProgrammeTime } =
  await import("../lib/saturday-schedule");
const candidates = saturdaySessions();
const result = await db().$transaction(
  async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(52731913)`;
    const existing = await tx.session.findMany({
      where: {
        OR: [
          { id: { in: candidates.map((s) => s.id) } },
          {
            startsAt: {
              gte: new Date(
                candidates[0].startsAt.toISOString().slice(0, 10) +
                  "T00:00:00Z",
              ),
              lt: new Date(candidates.at(-1)!.startsAt.getTime() + 86400000),
            },
          },
        ],
      },
      select: { id: true, startsAt: true, deadline: true, timezone: true },
    });
    const plan = saturdaySchedulePlan(existing, candidates);
    const verify: { id: string; startsAt: Date; capacity: number }[] =
      plan.create.map((s) => ({
        id: s.id,
        startsAt: s.startsAt,
        capacity: s.capacity,
      }));
    for (const change of plan.update) {
      // Use the same row lock as booking approvals and Space data edits.
      await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${change.id} FOR UPDATE`;
      const current = await tx.session.findUniqueOrThrow({
        where: { id: change.id },
      });
      const fresh = saturdaySchedulePlan([current], candidates).update.find(
        (s) => s.id === current.id,
      );
      if (fresh) {
        const { id, ...data } = fresh;
        const updated = await tx.session.update({ where: { id }, data });
        if (updated.status === "Scheduled" && updated.deadline > new Date())
          verify.push({
            id: updated.id,
            startsAt: updated.startsAt,
            capacity: updated.capacity,
          });
      }
    }
    const created = await tx.session.createMany({
      data: plan.create,
      skipDuplicates: true,
    });
    return { count: created.count, updated: plan.update.length, verify };
  },
  { timeout: 30000 },
);
console.log(
  `Published ${result.count} new Saturday sessions and aligned ${result.updated} existing sessions to 7 PM Europe/London (GMT/BST). Existing IDs, capacities, cancellations and bookings were preserved.`,
);
await db().$disconnect();
// On the hosted release, verify that the existing public calendar API sees new slots.
// No credentials or private founder records are sent or returned by this check.
if (
  result.verify.length > 0 &&
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
  const observed = data.sessions || [];
  if (
    result.verify.some(
      (expected) =>
        !observed.some(
          (s) =>
            s.id === expected.id &&
            new Date(s.startsAt).getTime() === expected.startsAt.getTime() &&
            isLondonProgrammeTime(s.startsAt) &&
            s.capacity === expected.capacity,
        ),
    )
  )
    throw new Error(
      "The public booking API did not return the updated London-time schedule.",
    );
  console.log(
    `Verified ${result.verify.length} London-time Saturday sessions through the live public booking API, including full sessions.`,
  );
}
