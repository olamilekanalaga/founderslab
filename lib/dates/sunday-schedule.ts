/** Sunday 7 PM Europe/London; UTC storage follows GMT/BST automatically. */
export const LONDON_TIME_ZONE = "Europe/London";
export function londonDay(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}
export function londonSundayStart(day: string) {
  const utc = new Date(`${day}T19:00:00.000Z`);
  // 19:00 is outside DST gaps/overlaps. The IANA timezone supplies the date's offset.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON_TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(utc),
  );
  return new Date(utc.getTime() - (hour - 19) * 3600000);
}
export function isLondonProgrammeTime(date: Date | string) {
  const value = new Date(date);
  return value.getTime() === londonSundayStart(londonDay(value)).getTime();
}
export function sundaySessions(now = new Date(), weeks = 12) {
  const first = new Date(`${londonDay(now)}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() + ((7 - first.getUTCDay()) % 7));
  if (
    londonSundayStart(first.toISOString().slice(0, 10)).getTime() <=
    now.getTime()
  )
    first.setUTCDate(first.getUTCDate() + 7);
  return Array.from({ length: weeks }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(date.getUTCDate() + index * 7);
    const day = date.toISOString().slice(0, 10),
      startsAt = londonSundayStart(day);
    return {
      id: `founders-lab-sunday-${day}`,
      title: "Founders Lab with ⭕️La_Crrypt💰₿",
      startsAt,
      timezone: LONDON_TIME_ZONE,
      host: "⭕️La_Crrypt💰₿",
      capacity: 4,
      deadline: startsAt,
      status: "Scheduled",
      researchStatus: "Not started",
      liveUrl: "",
      postUrl: "",
      recordingUrl: "",
      notes: "",
    };
  });
}
type ExistingSlot = {
  id: string;
  startsAt: Date;
  deadline: Date;
  timezone: string;
};
/** Reconcile by London date, preserving IDs, capacity, status and all relationships. */
export function sundaySchedulePlan(
  existing: ExistingSlot[],
  candidates = sundaySessions(),
) {
  const create: typeof candidates = [],
    update: {
      id: string;
      startsAt: Date;
      timezone: string;
      deadline?: Date;
    }[] = [];
  for (const candidate of candidates) {
    const found =
      existing.find((s) => s.id === candidate.id) ||
      existing.find(
        (s) => londonDay(s.startsAt) === londonDay(candidate.startsAt),
      );
    if (!found) {
      create.push(candidate);
      continue;
    }
    // Align managed slots and legacy fixed-UTC programme slots, not unrelated custom events.
    const recurring =
      found.id.startsWith("founders-lab-sunday-") ||
      found.id.startsWith("founders-lab-saturday-") ||
      (["UTC", "GMT", "Etc/UTC"].includes(found.timezone) &&
        found.startsAt.getUTCHours() === 19 &&
        found.startsAt.getUTCMinutes() === 0);
    if (
      recurring &&
      (found.startsAt.getTime() !== candidate.startsAt.getTime() ||
        found.timezone !== LONDON_TIME_ZONE)
    )
      update.push({
        id: found.id,
        startsAt: candidate.startsAt,
        timezone: LONDON_TIME_ZONE,
        ...(found.deadline.getTime() === found.startsAt.getTime()
          ? { deadline: candidate.deadline }
          : {}),
      });
  }
  return { create, update };
}
