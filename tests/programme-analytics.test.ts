import test from "node:test";
import assert from "node:assert/strict";
import type { DataState } from "@/lib/types";
import {
  programmeAnalytics,
  programmeDay,
  sessionSeries,
  founderSeries,
  presetRange,
  rangeError,
  comparison,
} from "@/features/reports/lib/programme-analytics";

function fixture() {
  return {
    founders: [],
    companies: [],
    applications: [],
    bookings: [],
    sessions: [],
    participants: [],
    spaceData: [],
    spaceAttendance: [],
  } as unknown as DataState;
}
const session = (
  id: string,
  startsAt: string,
  capacity = 4,
  status = "Completed",
) =>
  ({
    id,
    title: id,
    startsAt,
    capacity,
    status,
  }) as DataState["sessions"][number];
const founder = (id: string, createdAt: string) =>
  ({ id, createdAt, country: "Nigeria" }) as DataState["founders"][number];
const participant = (
  sessionId: string,
  companyId: string,
  attendance = "Approved",
) =>
  ({
    sessionId,
    companyId,
    attendance,
    speakers: 7,
  }) as DataState["participants"][number];
const record = (id: string, sessionId: string, liveListeners: number | null) =>
  ({
    id,
    sessionId,
    liveListeners,
    durationMinutes: null,
    submittedAt: null,
  }) as DataState["spaceData"][number];

test("analytics date scope keeps UTC added dates distinct from London Space dates", () => {
  const s = fixture();
  s.founders = [
    founder("included", "2027-06-06T23:59:59.999Z"),
    founder("before", "2027-06-05T23:59:59.999Z"),
    founder("after", "2027-06-07T00:00:00Z"),
  ];
  s.sessions = [
    session("london-next-day", "2027-06-05T23:15:00Z"),
    session("outside", "2027-06-06T23:15:00Z"),
  ];
  const result = programmeAnalytics(s, {
    from: "2027-06-06",
    to: "2027-06-06",
  });
  assert.deepEqual(
    result.founders.map((f) => f.id),
    ["included"],
  );
  assert.deepEqual(
    result.sessions.map((v) => v.id),
    ["london-next-day"],
  );
  assert.equal(programmeDay("2027-06-05T23:15:00Z"), "2027-06-06");
});
test("occupancy counts cofounders once and weights same-day Spaces by project capacity", () => {
  const s = fixture();
  s.sessions = [
    session("a", "2026-11-28T18:00:00Z", 4),
    session("b", "2026-11-28T19:00:00Z", 8),
    session("cancelled", "2026-11-28T20:00:00Z", 100, "Cancelled"),
  ];
  s.participants = [
    participant("a", "project-1"),
    participant("a", "project-1"),
    participant("a", "cancelled-project", "Cancelled"),
    participant("b", "project-2"),
    participant("b", "project-3"),
    participant("cancelled", "project-4"),
  ];
  const result = programmeAnalytics(s);
  assert.equal(result.seats, 3);
  assert.equal(result.capacity, 12);
  assert.equal(result.occupancy, 25);
  assert.deepEqual(sessionSeries(result.sessions, "occupancy", true), [
    { name: "2026-11-28", value: 25 },
  ]);
  s.sessions = [session("no-capacity", "2026-11-29T19:00:00Z", 0)];
  assert.equal(programmeAnalytics(s).occupancy, null);
});
test("recorded zero counts towards coverage while absent and cancelled results do not", () => {
  const s = fixture();
  s.sessions = [
    session("a", "2026-11-07T19:00:00Z"),
    session("b", "2026-11-14T19:00:00Z"),
    session("c", "2026-11-21T19:00:00Z"),
    session("d", "2026-11-28T19:00:00Z", 4, "Cancelled"),
  ];
  s.spaceData = [
    record("ra", "a", 17),
    record("rb", "b", 0),
    record("rc", "c", null),
    record("rd", "d", 499),
  ];
  s.spaceAttendance = [
    {
      spaceDataId: "ra",
      foundersCount: 2,
      otherTeamCount: 3,
    } as DataState["spaceAttendance"][number],
  ];
  const result = programmeAnalytics(s);
  assert.equal(result.totals.listeners, 17);
  assert.equal(result.coverage.listeners, 2);
  assert.equal(result.sessions.length, 3);
  assert.equal(result.totals.people, 5);
  assert.equal(result.totals.founders, 2);
  assert.equal(result.coverage.people, 1);
  assert.equal(result.totals.hours, null);
  assert.deepEqual(sessionSeries(result.sessions, "listeners", true), [
    { name: "2026-11-07", value: 17 },
    { name: "2026-11-14", value: 17 },
    { name: "2026-11-21", value: null },
  ]);
});
test("founder growth fills zero-addition dates and counts only the selected added-date period", () => {
  const s = fixture();
  s.founders = [
    founder("earlier", "2026-10-31T09:00:00Z"),
    founder("one", "2026-11-01T09:00:00Z"),
    founder("two", "2026-11-03T09:00:00Z"),
  ];
  const range = { from: "2026-11-01", to: "2026-11-03" };
  assert.deepEqual(founderSeries(s.founders, range, false), [
    { name: "2026-11-01", value: 1 },
    { name: "2026-11-02", value: 0 },
    { name: "2026-11-03", value: 1 },
  ]);
  assert.deepEqual(
    founderSeries(s.founders, range, true).map((p) => p.value),
    [1, 1, 2],
  );
});
test("application cohorts and session-scoped bookings stay distinct when one application has multiple requests", () => {
  const s = fixture();
  s.sessions = [session("a", "2026-11-28T19:00:00Z")];
  s.applications = [
    { id: "current", createdAt: "2026-11-23T10:00:00Z", status: "Approved" },
    { id: "old", createdAt: "2026-10-23T10:00:00Z", status: "Pending" },
  ] as DataState["applications"];
  s.bookings = [
    { applicationId: "current", sessionId: "a", status: "Pending" },
    { applicationId: "current", sessionId: "a", status: "Waitlisted" },
    { applicationId: "old", sessionId: "outside", status: "Approved" },
  ] as DataState["bookings"];
  const result = programmeAnalytics(s, {
    from: "2026-11-01",
    to: "2026-11-30",
  });
  assert.deepEqual(result.applicationStatuses, [
    { name: "Approved", value: 1 },
  ]);
  assert.equal(result.bookings.length, 2);
  assert.equal(
    result.bookingStatuses.reduce((n, r) => n + r.value, 0),
    2,
  );
});
test("invalid dates and zero comparison baselines cannot fabricate a trend percentage", () => {
  assert.equal(
    rangeError({ from: "2026-02-30", to: "" }),
    "Choose valid dates.",
  );
  assert.throws(
    () =>
      programmeAnalytics(fixture(), { from: "2026-12-01", to: "2026-11-01" }),
    RangeError,
  );
  assert.deepEqual(presetRange(7, new Date("2027-06-05T23:30:00Z")), {
    from: "2027-05-31",
    to: "2027-06-06",
  });
  assert.deepEqual(comparison(7, 0), { absolute: 7, percent: null });
  assert.equal(comparison(null, 7), null);
});
