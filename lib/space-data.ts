import type { DataState } from "./types";
export function spaceTotals(state: DataState, sessionId?: string) {
  const records = (state.spaceData || []).filter(
    (r) => !sessionId || r.sessionId === sessionId,
  );
  const ids = new Set(records.map((r) => r.id));
  const teams = (state.spaceAttendance || []).filter((t) =>
    ids.has(t.spaceDataId),
  );
  const listeners = records.filter((r) => r.liveListeners !== null);
  const durations = records.filter((r) => r.durationMinutes !== null);
  return {
    recordedSpaces: records.length,
    attendanceSpaces: new Set(teams.map((t) => t.spaceDataId)).size,
    founders: teams.length
      ? teams.reduce((n, t) => n + t.foundersCount, 0)
      : null,
    people: teams.length
      ? teams.reduce((n, t) => n + t.foundersCount + t.otherTeamCount, 0)
      : null,
    teamsAttended: teams.filter((t) => t.foundersCount + t.otherTeamCount > 0)
      .length,
    listeners: listeners.length
      ? listeners.reduce((n, r) => n + r.liveListeners!, 0)
      : null,
    durationMinutes: durations.length
      ? durations.reduce((n, r) => n + r.durationMinutes!, 0)
      : null,
  };
}
export function durationLabel(minutes: number | null) {
  if (minutes === null) return "—";
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return `${hours}h${rest ? ` ${rest}m` : ""}`;
}

export type SpaceMetric =
  "founders" | "people" | "listeners" | "durationMinutes";
/** Cumulative recorded activity by the Space date; absent values are omitted. */
export function spaceGrowth(state: DataState, metric: SpaceMetric) {
  const byDay = new Map<string, number>();
  for (const record of state.spaceData || []) {
    const session = state.sessions.find((s) => s.id === record.sessionId);
    if (!session) continue;
    const value = spaceTotals(state, record.sessionId)[metric];
    if (value === null) continue;
    const day = session.startsAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + value);
  }
  let total = 0;
  return [...byDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => {
      total += value;
      return {
        name,
        value:
          metric === "durationMinutes"
            ? Number((total / 60).toFixed(2))
            : total,
      };
    });
}
