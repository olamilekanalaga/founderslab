import type { DataState } from "@/lib/types";
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

/** One shared weekly session, with separate company-level attendance rows. */
export function profileSpaceWeeks(
  state: DataState,
  profile: { founderId?: string; companyId?: string },
) {
  const ownCompanies = new Set(
    profile.companyId
      ? [profile.companyId]
      : state.memberships
          .filter((m) => m.founderId === profile.founderId)
          .map((m) => m.companyId),
  );
  return state.sessions
    .filter(
      (session) =>
        state.participants.some(
          (p) =>
            p.sessionId === session.id &&
            p.attendance !== "Cancelled" &&
            (profile.founderId
              ? p.founderId === profile.founderId
              : ownCompanies.has(p.companyId)),
        ) ||
        (state.spaceAttendance || []).some(
          (a) =>
            ownCompanies.has(a.companyId) &&
            (state.spaceData || []).some(
              (r) => r.id === a.spaceDataId && r.sessionId === session.id,
            ),
        ),
    )
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((session) => {
      const record = (state.spaceData || []).find(
        (r) => r.sessionId === session.id,
      );
      const attendance = (state.spaceAttendance || []).filter(
        (a) => a.spaceDataId === record?.id,
      );
      const participants = state.participants.filter(
        (p) => p.sessionId === session.id && p.attendance !== "Cancelled",
      );
      const companyIds = [
        ...new Set([
          ...participants.map((p) => p.companyId),
          ...attendance.map((a) => a.companyId),
        ]),
      ];
      const teams = companyIds.map((companyId) => {
        const company = state.companies.find((c) => c.id === companyId)!;
        const row = attendance.find((a) => a.companyId === companyId);
        const members = participants.filter((p) => p.companyId === companyId);
        return {
          company,
          own: ownCompanies.has(companyId),
          foundersCount: row?.foundersCount ?? null,
          otherTeamCount: row?.otherTeamCount ?? null,
          people: row ? row.foundersCount + row.otherTeamCount : null,
          speakers: members.length
            ? Math.max(...members.map((p) => p.speakers))
            : null,
          founders: state.founders.filter((f) =>
            members.some((p) => p.founderId === f.id),
          ),
        };
      });
      return { session, record, totals: spaceTotals(state, session.id), teams };
    });
}
