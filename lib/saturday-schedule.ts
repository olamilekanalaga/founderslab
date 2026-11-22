/** User-approved weekly programme: Saturday 19:00 UTC, five project places. */
export function saturdaySessions(now = new Date(), weeks = 12) {
  const first = new Date(now);
  first.setUTCHours(19, 0, 0, 0);
  first.setUTCDate(first.getUTCDate() + ((6 - first.getUTCDay() + 7) % 7));
  if (first.getTime() <= now.getTime())
    first.setUTCDate(first.getUTCDate() + 7);
  return Array.from({ length: weeks }, (_, index) => {
    const startsAt = new Date(first);
    startsAt.setUTCDate(startsAt.getUTCDate() + index * 7);
    const day = startsAt.toISOString().slice(0, 10);
    return {
      id: `founders-lab-saturday-${day}`,
      title: "Founders Lab — Saturday Space",
      startsAt,
      timezone: "UTC",
      host: "Ola_Crrypt",
      capacity: 5,
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
