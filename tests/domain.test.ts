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
  const visible = scopeState(s, demoViewer("analyst").permissions);
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
