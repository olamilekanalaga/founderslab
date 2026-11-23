import type { DataState } from "@/lib/types";
import { approvedSeats } from "@/lib/domain/queries";
import { spaceTotals } from "@/features/spaces/lib/space-data";

export type AnalyticsRange = { from: string; to: string };
export type AnalyticsMetric =
  "listeners" | "people" | "founders" | "hours" | "records" | "occupancy";
export type AnalyticsPoint = { name: string; value: number | null };
export type AnalyticsSession = {
  id: string;
  title: string;
  day: string;
  capacity: number;
  seats: number;
  listeners: number | null;
  people: number | null;
  founders: number | null;
  hours: number | null;
  occupancy: number | null;
  submitted: boolean;
};
const dateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function programmeDay(value: string | Date) {
  const parts = dateParts.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
const utcDay = (value: string) => new Date(value).toISOString().slice(0, 10);
export function rangeError(range: AnalyticsRange): string | null {
  for (const value of [range.from, range.to]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      return "Choose valid dates.";
  }
  return range.from && range.to && range.from > range.to
    ? "The end date must be on or after the start date."
    : null;
}
export function presetRange(days: number, now: Date): AnalyticsRange {
  const to = programmeDay(now);
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: start.toISOString().slice(0, 10), to };
}
const inRange = (day: string, range: AnalyticsRange) =>
  (!range.from || day >= range.from) && (!range.to || day <= range.to);
function counts(values: string[]) {
  const result = new Map<string, number>();
  for (const value of values) {
    const key = value.trim() || "Not recorded";
    result.set(key, (result.get(key) || 0) + 1);
  }
  return [...result]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}
export function programmeAnalytics(
  state: DataState,
  range: AnalyticsRange = { from: "", to: "" },
) {
  const error = rangeError(range);
  if (error) throw new RangeError(error);
  const founders = state.founders.filter((f) =>
    inRange(utcDay(f.createdAt), range),
  );
  const companies = state.companies.filter((c) =>
    inRange(utcDay(c.createdAt), range),
  );
  const applications = state.applications.filter((a) =>
    inRange(utcDay(a.createdAt), range),
  );
  const sessions: AnalyticsSession[] = state.sessions
    .filter(
      (s) =>
        s.status !== "Cancelled" && inRange(programmeDay(s.startsAt), range),
    )
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((s) => {
      const totals = spaceTotals(state, s.id);
      const seats = approvedSeats(state, s.id);
      return {
        id: s.id,
        title: s.title,
        day: programmeDay(s.startsAt),
        capacity: s.capacity,
        seats,
        listeners: totals.listeners,
        people: totals.people,
        founders: totals.founders,
        hours:
          totals.durationMinutes === null ? null : totals.durationMinutes / 60,
        occupancy: s.capacity > 0 ? (100 * seats) / s.capacity : null,
        submitted: state.spaceData.some(
          (r) => r.sessionId === s.id && Boolean(r.submittedAt),
        ),
      };
    });
  const sessionIds = new Set(sessions.map((s) => s.id));
  const bookings = state.bookings.filter((b) => sessionIds.has(b.sessionId));
  const totals: Record<
    "listeners" | "people" | "founders" | "hours",
    number | null
  > = { listeners: null, people: null, founders: null, hours: null };
  const coverage: Record<
    "listeners" | "people" | "founders" | "hours",
    number
  > = { listeners: 0, people: 0, founders: 0, hours: 0 };
  for (const metric of ["listeners", "people", "founders", "hours"] as const) {
    const recorded = sessions.filter((s) => s[metric] !== null);
    coverage[metric] = recorded.length;
    totals[metric] = recorded.length
      ? recorded.reduce((sum, s) => sum + s[metric]!, 0)
      : null;
  }
  const capacitySessions = sessions.filter((s) => s.capacity > 0);
  const capacity = capacitySessions.reduce((sum, s) => sum + s.capacity, 0);
  const seats = capacitySessions.reduce((sum, s) => sum + s.seats, 0);
  return {
    founders,
    companies,
    applications,
    bookings,
    sessions,
    totals,
    coverage,
    submitted: sessions.filter((s) => s.submitted).length,
    occupancy: capacity > 0 ? (100 * seats) / capacity : null,
    seats,
    capacity,
    countries: counts(founders.map((f) => f.country)),
    sectors: counts(companies.map((c) => c.sector)),
    stages: counts(companies.map((c) => c.stage)),
    applicationStatuses: counts(applications.map((a) => a.status)),
    bookingStatuses: counts(bookings.map((b) => b.status)),
  };
}
export function founderSeries(
  founders: DataState["founders"],
  range: AnalyticsRange,
  cumulative: boolean,
): AnalyticsPoint[] {
  const ordered = founders
    .map((f) => utcDay(f.createdAt))
    .filter((day) => inRange(day, range))
    .sort();
  if (!ordered.length) return [];
  const from = range.from || ordered[0],
    to = range.to || ordered.at(-1)!;
  const monthly = (Date.parse(to) - Date.parse(from)) / 86_400_000 > 120;
  const grouped = new Map<string, number>();
  for (const day of ordered) {
    const key = monthly ? day.slice(0, 7) : day;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  const result: AnalyticsPoint[] = [];
  const cursor = new Date(
    `${monthly ? from.slice(0, 7) + "-01" : from}T00:00:00Z`,
  );
  const end = monthly ? to.slice(0, 7) : to;
  let total = 0;
  while (
    (monthly
      ? cursor.toISOString().slice(0, 7)
      : cursor.toISOString().slice(0, 10)) <= end
  ) {
    const name = cursor.toISOString().slice(0, monthly ? 7 : 10);
    const value = grouped.get(name) || 0;
    total += value;
    result.push({ name, value: cumulative ? total : value });
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
export function sessionSeries(
  sessions: AnalyticsSession[],
  metric: Exclude<AnalyticsMetric, "records">,
  cumulative: boolean,
): AnalyticsPoint[] {
  const grouped = new Map<
    string,
    { value: number | null; seats: number; capacity: number }
  >();
  for (const s of sessions) {
    const row = grouped.get(s.day) || { value: null, seats: 0, capacity: 0 };
    if (s[metric] !== null) row.value = (row.value ?? 0) + s[metric]!;
    if (s.capacity > 0) {
      row.seats += s.seats;
      row.capacity += s.capacity;
    }
    grouped.set(s.day, row);
  }
  let total = 0;
  return [...grouped]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, row]) => {
      if (metric === "occupancy")
        return {
          name,
          value: row.capacity > 0 ? (100 * row.seats) / row.capacity : null,
        };
      if (row.value === null) return { name, value: null };
      total += row.value;
      return { name, value: cumulative ? total : row.value };
    });
}
export function comparison(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  return {
    absolute: current - previous,
    percent: previous === 0 ? null : ((current - previous) / previous) * 100,
  };
}
