import test from "node:test";
import assert from "node:assert/strict";
import { utcInputValue, utcInputToIso } from "@/lib/dates/utc-input";

test("UTC editor retains the entered clock and serializes it once as UTC", () => {
  for (const clock of ["2026-12-05T19:00", "2027-06-05T18:00"]) {
    assert.equal(utcInputValue(clock), clock);
    assert.equal(utcInputToIso(clock), `${clock}:00.000Z`);
    assert.equal(utcInputValue(utcInputToIso(clock)), clock);
  }
  assert.equal(utcInputValue("2027-06-05T19:00:00+01:00"), "2027-06-05T18:00");
});
test("UTC editor dates display the programme's London winter and summer times correctly", () => {
  const london = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }).format(new Date(utcInputToIso(value)));
  assert.equal(london("2026-12-05T19:00"), "19:00");
  assert.equal(london("2027-06-05T18:00"), "19:00");
});
