import type { Prisma } from "@prisma/client";
import {
  sundaySessions,
  londonDay,
  sundaySchedulePlan,
} from "@/lib/dates/sunday-schedule";
import { DomainError } from "@/lib/domain";
export const WINDOW_WEEKS = 8;
export const PUBLIC_WINDOW_WEEKS = 3;
export async function lockProgramme(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(52731913)`;
}
export async function ensureProgrammeWindow(
  tx: Prisma.TransactionClient,
  now = new Date(),
) {
  await lockProgramme(tx);
  let schedule = await tx.programmeSchedule.upsert({
    where: { id: "main" },
    create: {
      id: "main",
      anchorDay: londonDay(sundaySessions(now, 1)[0].startsAt),
    },
    update: {},
  });
  for (;;) {
    const slots = Array.from({ length: WINDOW_WEEKS }, (_, i) => {
      const day = new Date(schedule.anchorDay + "T00:00:00Z");
      day.setUTCDate(day.getUTCDate() + 7 * (schedule.activeStart + i));
      return {
        position: schedule.activeStart + i,
        slot: sundaySessions(day, 1)[0],
      };
    });
    for (const { position, slot } of slots) {
      if (await tx.programmeWeek.findUnique({ where: { position } })) continue;
      const dayStart = new Date(londonDay(slot.startsAt) + "T00:00:00Z");
      const matches = await tx.session.findMany({
        where: {
          OR: [
            { id: slot.id },
            { startsAt: { gte: dayStart, lt: new Date(+dayStart + 86400000) } },
          ],
        },
      });
      const existing =
        matches.find((s) => s.id === slot.id) ||
        matches.find((s) => londonDay(s.startsAt) === londonDay(slot.startsAt));
      let sessionId = slot.id;
      if (existing) {
        sessionId = existing.id;
        await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId} FOR UPDATE`;
        const current = await tx.session.findUniqueOrThrow({
          where: { id: sessionId },
        });
        const change = sundaySchedulePlan([current], [slot]).update[0];
        if (change) {
          const { id, ...data } = change;
          await tx.session.update({ where: { id }, data });
        }
      } else await tx.session.create({ data: slot });
      await tx.programmeWeek.create({ data: { position, sessionId } });
    }
    const current = await tx.programmeWeek.findUnique({
      where: { position: schedule.activeStart },
      include: {
        session: {
          select: {
            status: true,
            spaceData: { select: { submittedAt: true } },
          },
        },
      },
    });
    if (
      !current ||
      (current.session.status !== "Completed" &&
        current.session.status !== "Cancelled" &&
        !current.session.spaceData?.submittedAt)
    )
      return schedule;
    const previous = schedule.activeStart;
    schedule = await tx.programmeSchedule.update({
      where: { id: "main" },
      data: { activeStart: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        actor: "Programme cycle",
        action: "programme.advance",
        entityId: "main",
        detail: `Week ${previous + 1} closed. Its record was kept and the next week opened.`,
      },
    });
  }
}
export async function requireProgrammeBooking(
  tx: Prisma.TransactionClient,
  sessionId: string,
  nextOnly = false,
) {
  const schedule = nextOnly
    ? await ensureProgrammeWindow(tx)
    : await tx.programmeSchedule.findUnique({ where: { id: "main" } });
  const week = await tx.programmeWeek.findUnique({ where: { sessionId } });
  if (
    !schedule ||
    !week ||
    week.position < schedule.activeStart ||
    week.position >= schedule.activeStart + WINDOW_WEEKS
  )
    throw new DomainError(
      "This Space is outside the current booking season. Choose a date from the calendar.",
      409,
    );
  if (nextOnly && week.position !== schedule.activeStart)
    throw new DomainError(
      "Booking opens after the previous Space is completed.",
      409,
    );
}
