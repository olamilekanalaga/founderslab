import test from "node:test";
import assert from "node:assert/strict";
import { makeSeed } from "../lib/seed";
import {
  applyCommand,
  createLocalApplication,
  demoViewer,
  approvedSeats,
  founderSessions,
  companySessions,
  scopeState,
} from "../lib/domain";
import { reportData, blankFilters } from "../lib/selectors";
import { csvContent, reportRows } from "../lib/export";
import { applicationSchema, schemas } from "../lib/validation";
import { RESEARCH_SECTIONS } from "../lib/catalog";
const admin = demoViewer();
const application = {
  founderName: "Test Founder",
  companyName: "New Product",
  xHandle: "new_test_founder",
  website: "https://product.example.invalid",
  country: "Nigeria",
  description: "A fictional product solving a specific customer workflow.",
  speakers: 3,
  teamSize: "2–5",
  stage: "MVP",
  sector: "Payments",
  focus: "Payments for small businesses",
  privacyConsent: true,
  promotionalConsent: false,
};
test("seed has 50 founders, global coverage, 10 completed Spaces and many-to-many memberships", () => {
  const s = makeSeed();
  assert.equal(s.founders.length, 50);
  assert.equal(s.companies.length, 50);
  assert.equal(s.sessions.filter((v) => v.status === "Completed").length, 10);
  assert.ok(s.memberships.length > 50);
  assert.equal(s.campaigns.length, 2);
  assert.ok(new Set(s.founders.map((f) => f.country)).size > 10);
  for (const p of s.participants) {
    assert.ok(s.founders.some((f) => f.id === p.founderId));
    assert.ok(s.companies.some((c) => c.id === p.companyId));
    assert.ok(s.sessions.some((v) => v.id === p.sessionId));
  }
});
test("applications validate consent, normalise duplicate identities and create linked records on approval", () => {
  assert.throws(() =>
    applicationSchema.parse({ ...application, privacyConsent: false }),
  );
  let s = createLocalApplication(makeSeed(), application);
  const a = s.applications.at(-1)!;
  assert.equal(a.status, "Pending");
  assert.throws(
    () =>
      createLocalApplication(s, {
        ...application,
        xHandle: "@NEW_TEST_FOUNDER",
        companyName: "  new   product ",
      }),
    /already exists/,
  );
  s = applyCommand(
    s,
    { type: "application.review", payload: { id: a.id, status: "Approved" } },
    admin,
  );
  const approved = s.applications.at(-1)!;
  assert.ok(approved.founderId && approved.companyId);
  assert.ok(
    s.memberships.some(
      (m) =>
        m.founderId === approved.founderId &&
        m.companyId === approved.companyId,
    ),
  );
  assert.equal(s.founders.length, 51);
  s = applyCommand(
    s,
    { type: "application.review", payload: { id: a.id, status: "Approved" } },
    admin,
  );
  assert.equal(s.founders.length, 51);
});
test("capacity counts projects rather than speakers and cancellation releases a seat", () => {
  let s = makeSeed();
  s.bookings = s.bookings.filter((b) => b.sessionId !== "up1");
  const ids: string[] = [];
  for (let i = 1; i <= 6; i++) {
    s = applyCommand(
      s,
      {
        type: "booking.create",
        payload: { applicationId: `a${i}`, sessionId: "up1", speakers: 3 },
      },
      admin,
    );
    ids.push(s.bookings.at(-1)!.id);
  }
  for (const id of ids.slice(0, 5))
    s = applyCommand(
      s,
      { type: "booking.review", payload: { id, status: "Approved" } },
      admin,
    );
  assert.equal(approvedSeats(s, "up1"), 5);
  assert.equal(
    s.participants
      .filter((p) => p.sessionId === "up1")
      .reduce((n, p) => n + p.speakers, 0),
    15,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "booking.review", payload: { id: ids[5], status: "Approved" } },
        admin,
      ),
    /full/,
  );
  s = applyCommand(
    s,
    { type: "booking.review", payload: { id: ids[0], status: "Cancelled" } },
    admin,
  );
  s = applyCommand(
    s,
    { type: "booking.review", payload: { id: ids[5], status: "Approved" } },
    admin,
  );
  assert.equal(approvedSeats(s, "up1"), 5);
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "session.save",
          payload: { ...s.sessions.find((v) => v.id === "up1"), capacity: 4 },
        },
        admin,
      ),
    /Capacity/,
  );
});
test("one session recording automatically appears on every founder and company timeline", () => {
  let s = makeSeed();
  const session = s.sessions.find((v) => v.id === "s1")!;
  const url = "https://recording.example.invalid/updated-once";
  s = applyCommand(
    s,
    { type: "session.save", payload: { ...session, recordingUrl: url } },
    admin,
  );
  for (const p of s.participants.filter((p) => p.sessionId === "s1")) {
    assert.equal(
      founderSessions(s, p.founderId).find((v) => v.session.id === "s1")
        ?.session.recordingUrl,
      url,
    );
    assert.equal(
      companySessions(s, p.companyId).find((v) => v.id === "s1")?.recordingUrl,
      url,
    );
    assert.equal(
      Object.hasOwn(
        s.founders.find((f) => f.id === p.founderId)!,
        "recordingUrl",
      ),
      false,
    );
  }
});
test("research requires a real appearance, preserves evidence and gates public publication", () => {
  let s = makeSeed();
  const r = s.research[0];
  const answers = Object.fromEntries(
    RESEARCH_SECTIONS.map((k) => [
      k,
      "Manually entered evidence and a specific founder observation.",
    ]),
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "research.save",
          payload: { ...r, answers: {}, status: "Complete" },
        },
        admin,
      ),
    /Complete every/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "research.save", payload: { ...r, answers, sessionId: "up4" } },
        admin,
      ),
    /participation/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "research.save",
          payload: {
            ...r,
            answers,
            visibility: "Public",
            verification: "Verified",
          },
        },
        demoViewer("researcher"),
      ),
    /admin/,
  );
  s = applyCommand(
    s,
    {
      type: "research.save",
      payload: {
        ...r,
        answers,
        visibility: "Public",
        verification: "Evidence reviewed",
        status: "Complete",
      },
    },
    admin,
  );
  assert.equal(s.answers.filter((a) => a.researchId === r.id).length, 12);
  assert.equal(s.research.find((v) => v.id === r.id)?.researcher, admin.name);
});
test("hiring claims require explicit evidence; opportunities require matching founders and company needs", () => {
  const s = makeSeed(),
    c = s.companies[0];
  assert.throws(() =>
    schemas["company.save"].parse({
      ...c,
      hiringStatus: "Hiring",
      hiringEvidence: "",
      founderIds: ["f1"],
      labelIds: [],
    }),
  );
  const o = s.opportunities[0];
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "opportunity.save", payload: { ...o, needId: "n2" } },
        admin,
      ),
    /documented need/,
  );
  const next = applyCommand(
    s,
    { type: "opportunity.save", payload: { ...o, status: "Qualified" } },
    admin,
  );
  assert.equal(next.activities.length, s.activities.length + 1);
  assert.equal(next.opportunities[0].status, "Qualified");
  assert.equal(s.opportunities[0].status, o.status);
});
test("role restrictions apply to commands and redact commercial, contact and team records", () => {
  const s = makeSeed();
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "session.save", payload: s.sessions[0] },
        demoViewer("analyst"),
      ),
    /permission/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "settings.save", payload: { ...s.settings } },
        demoViewer("researcher"),
      ),
    /permission/,
  );
  const visible = scopeState(s, [
    "directory.read",
    "research.read",
    "reports.read",
  ]);
  assert.equal(visible.opportunities.length, 0);
  assert.equal(visible.users.length, 0);
  assert.equal(visible.applications.length, 0);
  assert.ok(visible.founders.every((f) => f.contact === ""));
  assert.ok(visible.research.length > 0);
});
test("reports derive exact sample counts, retain missing data and export safe CSV", () => {
  const s = makeSeed(),
    all = reportData(s, blankFilters);
  assert.equal(all.founders.length, 50);
  assert.equal(all.companies.length, 50);
  assert.equal(
    all.countries.reduce((n, v) => n + v.value, 0),
    50,
  );
  const nigeria = reportData(s, { ...blankFilters, country: "Nigeria" });
  assert.equal(
    nigeria.founders.length,
    s.founders.filter((f) => f.country === "Nigeria").length,
  );
  const noCompany = {
    ...s,
    memberships: s.memberships.filter((m) => m.founderId !== "f50"),
  };
  assert.equal(reportData(noCompany, blankFilters).missing.companyProfiles, 1);
  const rows = reportRows(s, blankFilters, true);
  assert.ok(rows.some((r) => r.join(" ").includes("not representative")));
  assert.ok(
    csvContent([['=HYPERLINK("x")', "normal"]]).includes("'=HYPERLINK"),
  );
});
test("awards need eligible assessed founders and never initiate a transfer", () => {
  const s = makeSeed(),
    payload = {
      campaignId: "campaign2",
      founderId: "f50",
      rationale:
        "Documented progress against the published selection criteria.",
      decisionDate: new Date().toISOString(),
      status: "Selected",
      transactionReference: "",
    };
  assert.throws(
    () => applyCommand(s, { type: "award.save", payload }, admin),
    /eligible/,
  );
  let next = applyCommand(
    s,
    {
      type: "campaign.assess",
      payload: {
        campaignId: "campaign2",
        founderId: "f50",
        eligible: true,
        assessment:
          "Reviewed all published eligibility criteria and declared no conflicts.",
      },
    },
    admin,
  );
  next = applyCommand(next, { type: "award.save", payload }, admin);
  assert.equal(next.awards.at(-1)?.status, "Selected");
  assert.equal(next.awards.at(-1)?.transactionReference, "");
  assert.throws(() =>
    schemas["award.save"].parse({ ...payload, status: "Transferred" }),
  );
});

test("controlled taxonomy additions work for relationships and archived meanings remain stable", () => {
  let s = makeSeed();
  s = applyCommand(
    s,
    {
      type: "taxonomy.save",
      payload: {
        group: "Company relationship",
        name: "Research collaborator",
        active: true,
      },
    },
    admin,
  );
  const original = s.relationships[0];
  s = applyCommand(
    s,
    {
      type: "relationship.save",
      payload: { ...original, id: undefined, type: "Research collaborator" },
    },
    admin,
  );
  assert.equal(s.relationships.at(-1)?.type, "Research collaborator");
  const label = s.labels.find((l) => l.name === "Research collaborator")!;
  s = applyCommand(
    s,
    { type: "taxonomy.save", payload: { ...label, active: false } },
    admin,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "relationship.save",
          payload: { ...original, id: undefined, type: label.name },
        },
        admin,
      ),
    /active/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        {
          type: "taxonomy.save",
          payload: { ...label, name: "Changed historical meaning" },
        },
        admin,
      ),
    /original meaning/,
  );
  const saved = s.relationships.at(-1)!;
  assert.doesNotThrow(() =>
    applyCommand(
      s,
      {
        type: "relationship.save",
        payload: {
          ...saved,
          reason: "Clarified historical relationship evidence.",
        },
      },
      admin,
    ),
  );
});

test("business descriptions accept short answers while empty fields remain required", () => {
  assert.equal(
    applicationSchema.parse({ ...application, description: "Pay", focus: "AI" })
      .description,
    "Pay",
  );
  assert.throws(() =>
    applicationSchema.parse({ ...application, description: "  " }),
  );
  assert.throws(() => applicationSchema.parse({ ...application, focus: "  " }));
  const c = makeSeed().companies[0];
  assert.doesNotThrow(() =>
    schemas["company.save"].parse({
      ...c,
      description: "Pay",
      founderIds: ["f1"],
      labelIds: [],
    }),
  );
});

test("Space Data preserves unknowns, replaces attendance and aggregates actual totals", async () => {
  const { spaceTotals, durationLabel } = await import("../lib/space-data");
  let s = makeSeed();
  assert.equal(spaceTotals(s).people, null);
  const payload = {
    sessionId: s.sessions[0].id,
    liveListeners: 120,
    durationMinutes: 90,
    notes: "Counted by host",
    teams: [
      { companyId: s.companies[0].id, foundersCount: 2, otherTeamCount: 1 },
    ],
  };
  const save = (v: typeof payload) =>
    (s = applyCommand(s, { type: "space-data.save", payload: v }, admin));
  const bookings = JSON.stringify(s.bookings),
    sessions = JSON.stringify(s.sessions);
  save(payload);
  assert.equal(spaceTotals(s).people, 3);
  assert.equal(s.spaceData[0].recordedBy, admin.name);
  save({ ...payload, teams: [{ ...payload.teams[0], foundersCount: 1 }] });
  assert.equal(s.spaceData.length, 1);
  assert.equal(s.spaceAttendance.length, 1);
  save({
    ...payload,
    sessionId: s.sessions[1].id,
    liveListeners: 80,
    durationMinutes: 45,
  });
  assert.equal(spaceTotals(s).founders, 3);
  assert.equal(spaceTotals(s).people, 5);
  assert.equal(spaceTotals(s).listeners, 200);
  assert.equal(durationLabel(spaceTotals(s).durationMinutes), "2h 15m");
  assert.equal(JSON.stringify(s.bookings), bookings);
  assert.equal(JSON.stringify(s.sessions), sessions);
  assert.throws(
    () => save({ ...payload, teams: [payload.teams[0], payload.teams[0]] }),
    /once/,
  );
  assert.throws(() => save({ ...payload, sessionId: "missing" }));
  assert.throws(() =>
    save({
      ...payload,
      teams: [{ ...payload.teams[0], companyId: "missing" }],
    }),
  );
  assert.throws(() => save({ ...payload, liveListeners: -1 }));
  assert.throws(() =>
    save({ ...payload, teams: [{ ...payload.teams[0], foundersCount: 1.5 }] }),
  );
  save({ ...payload, liveListeners: 0, durationMinutes: 0, teams: [] });
  assert.equal(spaceTotals(s, payload.sessionId).listeners, 0);
  assert.equal(spaceTotals(s, payload.sessionId).people, null);
});

test("Space growth follows event dates, combines same-day totals and omits missing data", async () => {
  const { spaceGrowth } = await import("../lib/space-data");
  let s = makeSeed();
  const save = (
    sessionId: string,
    listeners: number | null,
    minutes: number | null,
  ) =>
    (s = applyCommand(
      s,
      {
        type: "space-data.save",
        payload: {
          sessionId,
          liveListeners: listeners,
          durationMinutes: minutes,
          notes: "",
          teams: [],
        },
      },
      admin,
    ));
  assert.deepEqual(spaceGrowth(s, "listeners"), []);
  save(s.sessions[1].id, 80, 45);
  save(s.sessions[0].id, 120, 90);
  const points = spaceGrowth(s, "listeners");
  assert.equal(points.at(-1)?.value, 200);
  assert.ok(points[0].name < points[1].name);
  assert.equal(spaceGrowth(s, "durationMinutes").at(-1)?.value, 2.25);
  save(s.sessions[0].id, null, null);
  assert.equal(spaceGrowth(s, "listeners").length, 1);
  assert.equal(spaceGrowth(s, "listeners")[0].value, 80);
});

test("calendar-first applications attach a pending Saturday booking atomically", async () => {
  const { createLocalBookingApplication } = await import("../lib/domain");
  const { isSaturday, publicSlotOpen } = await import("../lib/booking");
  const seed = makeSeed(),
    now = "2026-11-21T12:00:00.000Z";
  const session = seed.sessions.find((s) => s.id === "up1")!;
  assert.equal(isSaturday(session), true);
  assert.equal(publicSlotOpen(session, 5, Date.parse(now)), true);
  const saved = createLocalBookingApplication(
    seed,
    application,
    session.id,
    now,
  );
  const app = saved.applications.at(-1)!;
  assert.equal(saved.bookings.at(-1)?.applicationId, app.id);
  assert.equal(saved.bookings.at(-1)?.sessionId, session.id);
  assert.equal(saved.bookings.at(-1)?.status, "Pending");
  assert.equal(seed.applications.length, 50);
  assert.throws(() =>
    createLocalBookingApplication(seed, application, "missing", now),
  );
  const full = structuredClone(seed);
  full.sessions.find((s) => s.id === session.id)!.capacity = 0;
  assert.throws(() =>
    createLocalBookingApplication(full, application, session.id, now),
  );
  const weekday = { ...session, startsAt: "2026-12-04T17:00:00.000Z" };
  assert.equal(publicSlotOpen(weekday, 5, Date.parse(now)), false);
  assert.equal(publicSlotOpen(session, 5, Date.parse("2027-01-01")), false);
});
