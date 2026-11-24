import { saturdaySessions } from "@/lib/dates/saturday-schedule";
import { approvedSeats } from "@/lib/domain/queries";
import type { DataState } from "@/lib/types";

export function currentSaturday(state: DataState, now: Date, offset = 0) {
  const upcoming = saturdaySessions(now, offset + 1)[offset];
  const matchesTime = (session: DataState["sessions"][number]) =>
    Date.parse(session.startsAt) === upcoming.startsAt.getTime();
  const session =
    state.sessions.find((s) => s.id === upcoming.id && matchesTime(s)) ??
    state.sessions.find(
      (s) => state.programmeSessionIds?.includes(s.id) && matchesTime(s),
    ) ??
    state.sessions.find(matchesTime);
  return {
    startsAt: upcoming.startsAt,
    session,
    filled: session ? approvedSeats(state, session.id) : 0,
  };
}
