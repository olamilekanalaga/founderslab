import test from "node:test";
import assert from "node:assert/strict";
import { currentSunday } from "@/features/spaces/lib/current-sunday";
import { makeSeed } from "@/server/db/seed-data";

test("the dashboard targets the coming London Sunday through GMT and BST cutovers", () => {
  const state = makeSeed();
  state.sessions = [];
  for (const [now, expected] of [
    ["2026-11-23T09:00:00Z", "2026-11-29T19:00:00.000Z"],
    ["2026-11-26T19:00:00Z", "2026-11-29T19:00:00.000Z"],
    ["2026-11-27T23:00:00Z", "2026-11-29T19:00:00.000Z"],
    ["2026-11-29T18:59:59Z", "2026-11-29T19:00:00.000Z"],
    ["2026-11-29T19:00:00Z", "2026-12-06T19:00:00.000Z"],
    ["2027-04-04T17:59:59Z", "2027-04-04T18:00:00.000Z"],
    ["2027-04-04T18:00:00Z", "2027-04-11T18:00:00.000Z"],
  ]) {
    const result = currentSunday(state, new Date(now));
    assert.equal(result.startsAt.toISOString(), expected);
    assert.equal(result.session, undefined);
  }
});

test("the card uses configured capacity and counts confirmed projects once, excluding cancelled or moved participants", () => {
  const state = makeSeed();
  const now = new Date("2026-11-27T12:00:00Z");
  const [existing] = state.sessions;
  const session = {
    ...existing,
    startsAt: "2026-11-29T19:00:00.000Z",
    capacity: 8,
  };
  state.sessions = [session];
  const [participant] = state.participants;
  state.participants = [
    { ...participant, sessionId: session.id, attendance: "Approved" },
    {
      ...participant,
      sessionId: session.id,
      founderId: "another",
      attendance: "Approved",
    },
    {
      ...participant,
      sessionId: session.id,
      companyId: "cancelled",
      attendance: "Cancelled",
    },
    {
      ...participant,
      sessionId: "another-session",
      companyId: "moved",
      attendance: "Approved",
    },
  ];
  assert.equal(currentSunday(state, now).session?.capacity, 8);
  assert.equal(currentSunday(state, now).filled, 1);
  state.participants[0].attendance = "Cancelled";
  state.participants[1].attendance = "Cancelled";
  assert.equal(currentSunday(state, now).filled, 0);
  session.status = "Cancelled";
  assert.equal(currentSunday(state, now).session?.status, "Cancelled");
});
