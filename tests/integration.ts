/** Isolated PostgreSQL + production HTTP verification. Never resets an existing database. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { Client } from "pg";
import { chromium } from "@playwright/test";
import type { DataState } from "../lib/types";
try {
  process.loadEnvFile(".env");
} catch {}
const source = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!source)
  throw new Error(
    "Set TEST_DATABASE_URL to a local PostgreSQL server with database-creation privileges.",
  );
const url = new URL(source);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw new Error("Integration runner only creates databases on localhost.");
const database = `founders_lab_test_${randomBytes(6).toString("hex")}`;
const controlUrl = new URL(url);
controlUrl.pathname = "/postgres";
const control = new Client({ connectionString: controlUrl.toString() });
await control.connect();
await control.query(`CREATE DATABASE "${database}"`);
url.pathname = `/${database}`;
const origin = "http://localhost:3100";
const password = randomBytes(24).toString("base64url");
const env = {
  ...process.env,
  DATABASE_URL: "",
  DATABASE_DATABASE_URL: url.toString(),
  VERCEL_ENV: "production",
  VERCEL: "0",
  VERCEL_PROJECT_ID: "integration-fixture",
  APP_ORIGIN: origin,
  BOOTSTRAP_ADMIN_EMAIL: "admin@integration.example.invalid",
  BOOTSTRAP_ADMIN_NAME: "Integration Admin",
  BOOTSTRAP_ADMIN_PASSWORD: password,
  NODE_ENV: "production" as const,
};
let server: ReturnType<typeof spawn> | undefined;
let output = "";
function run(script: string, args: string[] = []) {
  const r = spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    env,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`${script} failed: ${r.stderr}`);
}
type Jar = { cookie: string; csrf: string };
const admin: Jar = { cookie: "", csrf: "" };
async function request(
  path: string,
  payload?: unknown,
  jar?: Jar,
  csrf = true,
) {
  const response = await fetch(origin + path, {
    method: payload === undefined ? "GET" : "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(jar?.cookie ? { Cookie: jar.cookie } : {}),
      ...(csrf && jar?.csrf ? { "X-CSRF-Token": jar.csrf } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    redirect: "manual",
  });
  const cookie = response.headers.get("set-cookie");
  if (jar && cookie) jar.cookie = cookie.split(";")[0];
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
async function command(type: string, payload: unknown, jar = admin) {
  const r = await request("/api/workspace", { type, payload }, jar);
  assert.equal(r.status, 200, `${type}: ${JSON.stringify(r.data)}`);
  return r.data.state as DataState;
}
let passed = 0;
function pass(name: string) {
  console.log(`PASS ${++passed}: ${name}`);
}
try {
  run("scripts/prepare-vercel.ts");
  run("scripts/prepare-vercel.ts");
  const initialDb = new Client({ connectionString: url.toString() });
  await initialDb.connect();
  assert.equal(
    (await initialDb.query('SELECT count(*)::int AS n FROM "Founder"')).rows[0]
      .n,
    0,
  );
  assert.equal(
    (await initialDb.query('SELECT count(*)::int AS n FROM "User"')).rows[0].n,
    1,
  );
  const slots = await initialDb.query(
    'SELECT id,"startsAt",capacity FROM "Session" ORDER BY "startsAt"',
  );
  assert.equal(slots.rows.length, 12);
  assert.ok(
    slots.rows.every(
      (row) =>
        new Date(row.startsAt).getUTCDay() === 6 &&
        new Date(row.startsAt).getUTCHours() === 19 &&
        row.capacity === 5,
    ),
  );
  await initialDb.query('UPDATE "Session" SET status=$1 WHERE id=$2', [
    "Cancelled",
    slots.rows[0].id,
  ]);
  run("scripts/prepare-vercel.ts");
  assert.equal(
    (
      await initialDb.query('SELECT status FROM "Session" WHERE id=$1', [
        slots.rows[0].id,
      ])
    ).rows[0].status,
    "Cancelled",
  );
  assert.equal(
    (await initialDb.query('SELECT count(*)::int AS n FROM "Session"')).rows[0]
      .n,
    12,
  );
  await initialDb.end();
  pass(
    "Production release initializes tables/defaults and one admin idempotently without fictional founders",
  );
  run("scripts/seed.ts", ["--demo"]);
  run("scripts/admin.ts");
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3100",
      "--hostname",
      "0.0.0.0",
    ],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(origin + "/api/health");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, "Production server started");
  assert.equal((await request("/api/workspace")).status, 401);
  assert.equal((await request("/demo")).status, 404);
  assert.equal((await request("/api/health")).data.status, "ready");
  assert.equal(
    (await fetch(origin + "/dashboard", { redirect: "manual" })).status,
    307,
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        email: env.BOOTSTRAP_ADMIN_EMAIL,
        password: "incorrect",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/auth/login",
        { email: env.BOOTSTRAP_ADMIN_EMAIL, password },
        admin,
      )
    ).status,
    200,
  );
  const me = await request("/api/auth/me", undefined, admin);
  admin.csrf = me.data.viewer.csrf;
  assert.ok(admin.cookie && admin.csrf);
  let state = (await request("/api/workspace", undefined, admin)).data
    .state as DataState;
  assert.equal(state.founders.length, 50);
  assert.equal(
    state.sessions.filter((s) => s.status === "Completed").length,
    10,
  );
  assert.equal(
    (
      await request(
        "/api/workspace",
        {
          type: "application.review",
          payload: { id: "a1", status: "Approved" },
        },
        admin,
        false,
      )
    ).status,
    403,
  );
  pass(
    "Production server, authentication, anonymous access rejection and CSRF enforcement",
  );
  const application = {
    founderName: "Integration Fictional",
    companyName: "Isolated Example",
    xHandle: "isolated_example",
    website: "https://isolated.example.invalid",
    country: "Nigeria",
    description: "Pay",
    speakers: 3,
    teamSize: "2–5",
    stage: "MVP",
    sector: "Payments",
    focus: "AI",
    privacyConsent: true,
    promotionalConsent: false,
  };
  const result = await request("/api/public/apply", application);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  const capability = result.data.token;
  assert.equal(
    (
      await request("/api/public/apply", {
        ...application,
        xHandle: "@ISOLATED_EXAMPLE",
        companyName: " isolated   example ",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/public/confirmation", {
        token: result.data.reference,
      })
    ).status,
    400,
  );
  const confirmation = await request("/api/public/confirmation", {
    token: capability,
  });
  assert.equal(confirmation.status, 200);
  assert.deepEqual(Object.keys(confirmation.data).sort(), [
    "bookings",
    "companyName",
    "reference",
    "status",
  ]);
  state = (await request("/api/workspace", undefined, admin)).data.state;
  const app = state.applications.find(
    (a) => a.reference === result.data.reference,
  )!;
  state = await command("application.review", {
    id: app.id,
    status: "Approved",
  });
  const linked = state.applications.find((a) => a.id === app.id)!;
  assert.ok(linked.founderId && linked.companyId);
  assert.ok(
    state.memberships.some(
      (m) =>
        m.founderId === linked.founderId && m.companyId === linked.companyId,
    ),
  );
  const sessionPayload = {
    title: "Isolated concurrency session",
    startsAt: "2027-06-12T17:00:00.000Z",
    timezone: "Africa/Lagos",
    host: "Fictional host",
    capacity: 5,
    deadline: "2027-06-11T17:00:00.000Z",
    status: "Scheduled",
    researchStatus: "Not started",
    liveUrl: "",
    recordingUrl: "",
    notes: "Integration fixture",
  };
  state = await command("session.save", sessionPayload);
  const session = state.sessions.find((s) => s.title === sessionPayload.title)!;
  assert.equal(
    (
      await request("/api/public/book", {
        token: capability,
        sessionId: session.id,
      })
    ).status,
    201,
  );
  const confirmed = await request("/api/public/confirmation", {
    token: capability,
  });
  assert.equal(confirmed.data.bookings[0].status, "Pending");
  assert.equal(
    (
      await request("/api/public/book", {
        token: capability,
        sessionId: session.id,
      })
    ).status,
    409,
  );
  const companyToClassify = state.companies.find(
    (c) => c.id === linked.companyId,
  )!;
  const labelIds = state.labels
    .filter(
      (l) =>
        (l.group === "Sector" && l.name === "Payments") ||
        (l.group === "Product stage" && l.name === "MVP") ||
        (l.group === "Business model" && l.name === "Subscription"),
    )
    .map((l) => l.id);
  state = await command("company.save", {
    ...companyToClassify,
    founderIds: [linked.founderId],
    labelIds,
    businessModels: ["Subscription"],
  });
  assert.equal(
    state.companyLabels.filter((l) => l.companyId === linked.companyId).length,
    labelIds.length,
  );
  const classificationPage = await fetch(origin + "/companies", {
    headers: { Cookie: admin.cookie },
  });
  assert.equal(classificationPage.status, 200);
  assert.ok((await classificationPage.text()).includes("Company directory"));
  pass(
    "Public application validation, normalised duplicate prevention, approval and limited-scope confirmation",
  );
  const applicationIds = [app.id, ...["a1", "a2", "a3", "a4", "a5"]];
  for (const id of applicationIds.slice(1))
    state = await command("booking.create", {
      applicationId: id,
      sessionId: session.id,
      speakers: 3,
    });
  const bookingIds = state.bookings
    .filter((b) => b.sessionId === session.id)
    .map((b) => b.id);
  assert.equal(bookingIds.length, 6);
  const reviews = await Promise.all(
    bookingIds.map((id) =>
      request(
        "/api/workspace",
        { type: "booking.review", payload: { id, status: "Approved" } },
        admin,
      ),
    ),
  );
  assert.equal(
    reviews.filter((r) => r.status === 200).length,
    5,
    JSON.stringify(reviews.filter((r) => r.status !== 200).map((r) => r.data)),
  );
  assert.equal(reviews.filter((r) => r.status === 400).length, 1);
  state = (await request("/api/workspace", undefined, admin)).data.state;
  const participants = state.participants.filter(
    (p) => p.sessionId === session.id && p.attendance !== "Cancelled",
  );
  assert.equal(new Set(participants.map((p) => p.companyId)).size, 5);
  assert.equal(
    participants.reduce((sum, p) => sum + p.speakers, 0),
    15,
  );
  const publicSessions = await request("/api/public/sessions");
  const publicSession = publicSessions.data.sessions.find(
    (s: { id: string }) => s.id === session.id,
  );
  assert.equal(publicSession.availableSeats, 0);
  assert.ok(!("participants" in publicSession));
  assert.ok(!("notes" in publicSession));
  assert.equal(
    (
      await request(
        "/api/workspace",
        { type: "session.save", payload: { ...session, capacity: 4 } },
        admin,
      )
    ).status,
    400,
  );
  pass(
    "Six concurrent approvals produce five project seats, fifteen speakers, and one capacity rejection",
  );
  const calendarApplication = {
    ...application,
    founderName: "Calendar Founder",
    companyName: "Calendar Product",
    xHandle: "calendar_product",
    sessionId: "up3",
  };
  const calendarResult = await request(
    "/api/public/apply",
    calendarApplication,
  );
  assert.equal(calendarResult.status, 201, JSON.stringify(calendarResult.data));
  const calendarConfirmation = await request("/api/public/confirmation", {
    token: calendarResult.data.token,
  });
  assert.equal(calendarConfirmation.data.bookings.length, 1);
  assert.equal(calendarConfirmation.data.bookings[0].status, "Pending");
  const beforeFailed = (await request("/api/workspace", undefined, admin)).data
    .state.applications.length;
  assert.equal(
    (
      await request("/api/public/apply", {
        ...calendarApplication,
        companyName: "Full Product",
        xHandle: "full_product",
        sessionId: session.id,
      })
    ).status,
    409,
  );
  state = await command("session.save", {
    ...sessionPayload,
    title: "Closed weekday",
    startsAt: "2027-06-11T17:00:00.000Z",
  });
  const weekday = state.sessions.find((s) => s.title === "Closed weekday")!;
  assert.equal(
    (
      await request("/api/public/apply", {
        ...calendarApplication,
        companyName: "Weekday Product",
        xHandle: "weekday_product",
        sessionId: weekday.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (await request("/api/workspace", undefined, admin)).data.state.applications
      .length,
    beforeFailed,
  );
  pass(
    "Calendar-first submission creates a linked pending booking; full and weekday submissions roll back without orphan applications",
  );
  const stats = {
    sessionId: session.id,
    postUrl: "https://posts.example.invalid/shared/week",
    liveListeners: 150,
    durationMinutes: 95,
    notes: "Host attendance count",
    teams: [
      { companyId: state.companies[0].id, foundersCount: 2, otherTeamCount: 3 },
    ],
  };
  state = await command("space-data.save", stats);
  assert.equal(
    state.spaceData.find((r) => r.sessionId === session.id)?.liveListeners,
    150,
  );
  state = await command("space-data.save", { ...stats, liveListeners: 160 });
  assert.equal(
    state.sessions.find((row) => row.id === session.id)!.postUrl,
    stats.postUrl,
  );
  assert.equal(
    state.spaceData.filter((r) => r.sessionId === session.id).length,
    1,
  );
  assert.equal(
    state.spaceAttendance.filter(
      (r) =>
        r.spaceDataId ===
        state.spaceData.find((v) => v.sessionId === session.id)!.id,
    ).length,
    1,
  );
  assert.equal(
    (
      await request(
        "/api/workspace",
        {
          type: "space-data.save",
          payload: { ...stats, teams: [...stats.teams, ...stats.teams] },
        },
        admin,
      )
    ).status,
    400,
  );
  assert.equal((await request("/space-data")).status, 307);
  pass(
    "Private Space Data persists actual attendance and rejects duplicate projects",
  );
  const recording = "https://spaces.example.invalid/recording/database-shared";
  state = await command("session.save", {
    ...state.sessions.find((row) => row.id === session.id)!,
    recordingUrl: recording,
  });
  const { founderSessions, companySessions } = await import("../lib/domain");
  for (const p of participants) {
    assert.equal(
      founderSessions(state, p.founderId).find(
        (s) => s.session.id === session.id,
      )?.session.recordingUrl,
      recording,
    );
    assert.equal(
      companySessions(state, p.companyId).find((s) => s.id === session.id)
        ?.recordingUrl,
      recording,
    );
  }
  const check = new Client({ connectionString: url.toString() });
  await check.connect();
  const rows = await check.query(
    'SELECT "recordingUrl" FROM "Session" WHERE id=$1',
    [session.id],
  );
  assert.equal(rows.rows[0].recordingUrl, recording);
  const columns = await check.query(
    "SELECT table_name FROM information_schema.columns WHERE column_name='recordingUrl' AND table_schema='public'",
  );
  assert.deepEqual(
    columns.rows.map((r) => r.table_name),
    ["Session"],
  );
  await check.end();
  pass(
    "Relational persistence and one shared recording inherited by all linked profiles",
  );
  const rejectedRole = await request(
    "/api/workspace",
    {
      type: "invite.create",
      payload: {
        email: "removed_role@integration.example.invalid",
        name: "Removed role",
        roleId: "researcher",
      },
    },
    admin,
  );
  assert.equal(rejectedRole.status, 400);
  const invitation = await request(
    "/api/workspace",
    {
      type: "invite.create",
      payload: {
        email: "extra_admin@integration.example.invalid",
        name: "Additional Admin",
        roleId: "admin",
      },
    },
    admin,
  );
  assert.equal(invitation.status, 200);
  const inviteToken = invitation.data.invitationPath.split("token=")[1];
  const invited: Jar = { cookie: "", csrf: "" },
    invitedPassword = randomBytes(24).toString("hex");
  assert.equal(
    (
      await request(
        "/api/auth/accept-invite",
        { token: inviteToken, password: invitedPassword },
        invited,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/auth/accept-invite", {
        token: inviteToken,
        password: invitedPassword,
      })
    ).status,
    400,
  );
  const invitedMe = await request("/api/auth/me", undefined, invited);
  assert.equal(invitedMe.data.viewer.roleId, "admin");
  invited.csrf = invitedMe.data.viewer.csrf;
  assert.equal(
    (await request("/api/workspace", undefined, invited)).status,
    200,
  );
  // A previously valid session must lose access immediately if its role is retired.
  const policyDb = new Client({ connectionString: url.toString() });
  await policyDb.connect();
  await policyDb.query('INSERT INTO "Role" (id,name) VALUES ($1,$2),($3,$4)', [
    "researcher",
    "Retired researcher",
    "host",
    "Retired host",
  ]);
  await policyDb.query('UPDATE "User" SET "roleId"=$1 WHERE email=$2', [
    "researcher",
    "extra_admin@integration.example.invalid",
  ]);
  assert.equal((await request("/api/auth/me", undefined, invited)).status, 401);
  assert.equal(
    (await request("/api/workspace", undefined, invited)).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/workspace",
        { type: "settings.save", payload: {} },
        invited,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        email: "extra_admin@integration.example.invalid",
        password: invitedPassword,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(origin + "/dashboard", {
        headers: { Cookie: invited.cookie },
        redirect: "manual",
      })
    ).status,
    307,
  );
  const oldInvitation = await request(
    "/api/workspace",
    {
      type: "invite.create",
      payload: {
        email: "old_invite@integration.example.invalid",
        name: "Old invitation",
        roleId: "admin",
      },
    },
    admin,
  );
  assert.equal(oldInvitation.status, 200);
  await policyDb.query('UPDATE "Invitation" SET "roleId"=$1 WHERE email=$2', [
    "host",
    "old_invite@integration.example.invalid",
  ]);
  await policyDb.end();
  assert.equal(
    (
      await request("/api/auth/accept-invite", {
        token: oldInvitation.data.invitationPath.split("token=")[1],
        password: invitedPassword,
      })
    ).status,
    400,
  );
  pass(
    "Admin-only invitations and workspace access; retired-role logins, existing sessions and invitations are rejected",
  );
  const research = state.research[0],
    answers = Object.fromEntries(
      state.answers
        .filter((a) => a.researchId === research.id)
        .map((a) => [a.section, a.response]),
    );
  state = await command("research.save", {
    ...research,
    answers,
    visibility: "Public",
    verification: "Evidence reviewed",
    status: "Complete",
  });
  const consentDb = new Client({ connectionString: url.toString() });
  await consentDb.connect();
  await consentDb.query(
    'UPDATE "ResearchRecord" SET visibility=$2 WHERE id<>$1',
    [research.id, "Private"],
  );
  await consentDb.query(
    'UPDATE "Application" SET "promotionalConsent"=false WHERE "founderId"=$1 AND "companyId"=$2',
    [research.founderId, research.companyId],
  );
  const withoutConsent = await request("/api/public/programme");
  assert.equal(withoutConsent.data.highlights.length, 0);
  await consentDb.query(
    'UPDATE "Application" SET "promotionalConsent"=true WHERE "founderId"=$1 AND "companyId"=$2',
    [research.founderId, research.companyId],
  );
  await consentDb.end();
  const programme = await request("/api/public/programme");
  assert.equal(programme.data.highlights.length, 1);
  assert.equal(
    programme.data.highlights[0].company,
    state.companies.find((c) => c.id === research.companyId)?.name,
  );
  assert.equal(programme.status, 200);
  assert.ok(
    programme.data.highlights.every(
      (h: { company: string }) =>
        h.company !==
        state.companies.find((c) => c.id === linked.companyId)?.name,
    ),
  );
  assert.ok(!("founders" in programme.data));
  const { reportData, blankFilters } = await import("../lib/selectors");
  const report = reportData(state, blankFilters);
  assert.equal(report.founders.length, 51);
  assert.equal(
    report.countries.reduce((sum, c) => sum + c.value, 0),
    51,
  );
  assert.equal(
    reportData(state, { ...blankFilters, country: "Nigeria" }).founders.length,
    21,
  );
  pass(
    "Database-derived reporting totals and consent-gated public research publication",
  );
  const browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/signin");
    await page.getByLabel("Email").fill(env.BOOTSTRAP_ADMIN_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page
      .getByRole("heading", { name: "Overview", exact: true })
      .waitFor();
    await page.goto(origin + "/founders/" + linked.founderId);
    await page
      .getByRole("heading", { name: "Integration Fictional", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: "artifacts/private-founder-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  pass(
    "Production mobile sign-in, private dashboard and newly approved founder profile render without runtime errors",
  );
  console.log(
    `${passed} PostgreSQL/production HTTP integration groups passed.`,
  );
} catch (error) {
  console.error(error);
  if (output.includes("Error")) console.error(output.slice(-2500));
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await Promise.race([
      once(server, "exit"),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  }
  await control.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await control.end();
}
