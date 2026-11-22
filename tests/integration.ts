/** Isolated PostgreSQL + production HTTP verification. Never resets an existing database. */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { Client } from "pg";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { isLondonProgrammeTime } from "@/lib/dates/saturday-schedule";
import type { DataState } from "@/lib/types";
import {
  PARTICIPATION_TERMS,
  RETIRED_AWARD_COMMANDS,
} from "@/lib/programme-policy";
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
const mail: { to: string[]; text: string }[] = [];
let rejectEmail = false;
const mailServer = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk.toString();
  mail.push(JSON.parse(raw));
  res.writeHead(rejectEmail ? 422 : 200, {
    "Content-Type": "application/json",
  });
  res.end(
    JSON.stringify(
      rejectEmail
        ? { error: "Unverified sender" }
        : { id: crypto.randomUUID() },
    ),
  );
});
await new Promise<void>((resolve) =>
  mailServer.listen(0, "127.0.0.1", resolve),
);
const mailAddress = mailServer.address();
if (!mailAddress || typeof mailAddress === "string")
  throw new Error("Mock email unavailable");
const env = {
  ...process.env,
  DATABASE_URL: "",
  DATABASE_DATABASE_URL: url.toString(),
  VERCEL_ENV: "production",
  VERCEL: "0",
  VERCEL_PROJECT_ID: "integration-fixture",
  APP_ORIGIN: origin,
  RESEND_API_KEY: "isolated-provider-mock",
  MANAGER_EMAIL_FROM: "Founders Lab <test@example.invalid>",
  TEST_EMAIL_ENDPOINT: `http://127.0.0.1:${mailAddress.port}`,

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
  method?: string,
) {
  const response = await fetch(origin + path, {
    method: method || (payload === undefined ? "GET" : "POST"),
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
  return { status: response.status, data, headers: response.headers };
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
  assert.equal(slots.rows.length, 8);
  assert.ok(
    slots.rows.every(
      (row) =>
        new Date(row.startsAt).getUTCDay() === 6 &&
        isLondonProgrammeTime(row.startsAt) &&
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
    8,
  );
  await initialDb.query('DELETE FROM "ProgrammeWeek"');
  await initialDb.query('DELETE FROM "ProgrammeSchedule"');
  await initialDb.end();
  pass(
    "Production release initializes tables/defaults and one admin idempotently without fictional founders",
  );
  run("scripts/seed.ts", ["--demo"]);
  const scheduleDb = new Client({ connectionString: url.toString() });
  await scheduleDb.connect();
  const beforeBookingIds = (
    await scheduleDb.query(
      'SELECT id FROM "BookingRequest" WHERE "sessionId"=$1 ORDER BY id',
      ["up1"],
    )
  ).rows.map((r) => r.id);
  run("scripts/publish-saturdays.ts");
  run("scripts/publish-saturdays.ts");
  assert.equal(
    (
      await scheduleDb.query('SELECT timezone FROM "Session" WHERE id=$1', [
        "up1",
      ])
    ).rows[0].timezone,
    "Europe/London",
  );
  assert.deepEqual(
    (
      await scheduleDb.query(
        'SELECT id FROM "BookingRequest" WHERE "sessionId"=$1 ORDER BY id',
        ["up1"],
      )
    ).rows.map((r) => r.id),
    beforeBookingIds,
  );
  assert.equal(
    (
      await scheduleDb.query(
        'SELECT count(*)::int AS n FROM "Session" WHERE "startsAt"=$1',
        ["2026-12-05T19:00:00Z"],
      )
    ).rows[0].n,
    1,
  );
  await scheduleDb.end();
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
  for (const route of ["/", "/apply", "/book", "/confirmation", "/signin"]) {
    assert.equal((await fetch(origin + route)).status, 200, route);
  }
  for (const route of [
    "/dashboard",
    "/founders",
    "/founders/f1",
    "/companies",
    "/spaces",
    "/reports",
    "/campaigns",
    "/settings",
  ]) {
    const response = await fetch(origin + route, { redirect: "manual" });
    assert.equal(response.status, 307, route);
    assert.equal(
      new URL(response.headers.get("location")!, origin).pathname,
      "/signin",
    );
  }
  for (const route of ["/signup", "/register", "/invite"]) {
    assert.equal((await fetch(origin + route)).status, 404, route);
  }
  assert.equal(
    (await request("/api/workspace", { type: "settings.save", payload: {} }))
      .status,
    401,
  );
  assert.equal((await request("/api/auth/me")).status, 401);
  const forged = { cookie: "fl_session=invalid-forged-session", csrf: "" };
  assert.equal(
    (await request("/api/workspace", undefined, forged)).status,
    401,
  );

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
  const cookieProbe = await request("/api/auth/login", {
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    password,
  });
  const cookieHeader = cookieProbe.headers.get("set-cookie")!;
  for (const attribute of ["HttpOnly", "Secure", "SameSite=strict", "Path=/"])
    assert.ok(cookieHeader.toLowerCase().includes(attribute.toLowerCase()));
  const foreign = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: {
      Origin: "https://evil.example.invalid",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: env.BOOTSTRAP_ADMIN_EMAIL, password }),
  });
  assert.equal(foreign.status, 403);

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
    id: "up4",
    title: "Isolated concurrency session",
    startsAt: "2026-12-26T19:00:00.000Z",
    timezone: "Africa/Lagos",
    host: "Fictional host",
    capacity: 5,
    deadline: "2026-12-26T19:00:00.000Z",
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
    id: undefined,
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
  const { founderSessions, companySessions } = await import("@/lib/domain");
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
  for (const roleId of ["admin", "researcher"]) {
    assert.equal(
      (
        await request(
          "/api/workspace",
          {
            type: "invite.create",
            payload: {
              email: "blocked@example.invalid",
              name: "Blocked",
              roleId,
            },
          },
          admin,
        )
      ).status,
      403,
    );
  }
  for (const action of ["accept-invite", "signup", "register", "bootstrap"]) {
    assert.equal(
      (
        await request("/api/auth/" + action, {
          token: "a".repeat(40),
          password,
        })
      ).status,
      404,
    );
  }
  const policyDb = new Client({ connectionString: url.toString() });
  await policyDb.connect();
  const { passwordHash } = await import("@/server/auth/passwords");
  await policyDb.query(
    'INSERT INTO "User" (id,email,name,"passwordHash","roleId",active,"customPermissions","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,true,false,NOW(),NOW())',
    [
      "other-admin",
      "other@example.invalid",
      "Other administrator",
      passwordHash(password),
      "admin",
    ],
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        email: "other@example.invalid",
        password,
      })
    ).status,
    401,
  );
  const savedHash = (
    await policyDb.query('SELECT "passwordHash" FROM "User" WHERE email=$1', [
      env.BOOTSTRAP_ADMIN_EMAIL,
    ])
  ).rows[0].passwordHash;
  assert.notEqual(savedHash, password);
  await policyDb.query('UPDATE "User" SET active=false WHERE email=$1', [
    env.BOOTSTRAP_ADMIN_EMAIL,
  ]);
  assert.equal((await request("/api/workspace", undefined, admin)).status, 401);
  await policyDb.query('UPDATE "User" SET active=true WHERE email=$1', [
    env.BOOTSTRAP_ADMIN_EMAIL,
  ]);
  await policyDb.query('INSERT INTO "Role" (id,name) VALUES ($1,$2)', [
    "researcher",
    "Retired researcher",
  ]);
  await policyDb.query('UPDATE "User" SET "roleId"=$1 WHERE email=$2', [
    "researcher",
    env.BOOTSTRAP_ADMIN_EMAIL,
  ]);
  assert.equal((await request("/api/workspace", undefined, admin)).status, 401);
  await policyDb.query('UPDATE "User" SET "roleId"=$1 WHERE email=$2', [
    "admin",
    env.BOOTSTRAP_ADMIN_EMAIL,
  ]);
  await policyDb.query(
    'UPDATE "User" SET "customPermissions"=true WHERE email=$1',
    [env.BOOTSTRAP_ADMIN_EMAIL],
  );
  assert.equal(
    (
      await request(
        "/api/workspace",
        { type: "settings.save", payload: {} },
        admin,
      )
    ).status,
    403,
  );
  await policyDb.query(
    'UPDATE "User" SET "customPermissions"=false WHERE email=$1',
    [env.BOOTSTRAP_ADMIN_EMAIL],
  );
  await policyDb.end();
  pass(
    "Only the provisioned administrator can sign in; invitations/signup are disabled and inactive sessions lose access",
  );
  // Separate passwordless access: the Admin allowlist and credentials remain unchanged.
  const managerEmail = "manager@integration.example.invalid";
  const adminManagerRequest = (payload: unknown) =>
    request("/api/space-managers", payload, admin);
  assert.equal((await request("/api/space-managers")).status, 401);
  assert.equal((await request("/api/manager/spaces")).status, 401);
  assert.equal(
    (
      await request("/api/space-managers", {
        action: "invite",
        email: managerEmail,
        sessionIds: [session.id],
      })
    ).status,
    401,
  );
  const invite = await adminManagerRequest({
    action: "invite",
    email: managerEmail,
    sessionIds: [session.id],
  });
  assert.equal(invite.status, 201, JSON.stringify(invite.data));
  assert.equal(mail.at(-1)!.to[0], managerEmail);
  const emailToken = () =>
    new URL(mail.at(-1)!.text.match(/http[^\s]+/)![0]).hash.split("token=")[1];
  const firstToken = emailToken();
  let managerList = (await request("/api/space-managers", undefined, admin))
    .data.managers;
  const managerId = managerList.find(
    (m: { email: string }) => m.email === managerEmail,
  ).id;
  assert.equal(
    managerList.find((m: { id: string }) => m.id === managerId).status,
    "Pending",
  );
  assert.ok(!JSON.stringify(managerList).includes(firstToken));
  assert.equal(
    (await adminManagerRequest({ action: "resend", id: managerId })).status,
    200,
  );
  assert.equal(
    (await request("/api/manager/verify", { token: firstToken })).status,
    401,
  );
  const manager: Jar = { cookie: "", csrf: "" };
  const activeToken = emailToken();
  const verified = await request(
    "/api/manager/verify",
    { token: activeToken },
    manager,
  );
  assert.equal(verified.status, 200);
  for (const attribute of ["HttpOnly", "Secure", "SameSite=strict"])
    assert.ok(
      verified.headers
        .get("set-cookie")!
        .toLowerCase()
        .includes(attribute.toLowerCase()),
    );
  assert.equal(
    (await request("/api/manager/verify", { token: activeToken })).status,
    401,
  );
  const assigned = await request("/api/manager/spaces", undefined, manager);
  manager.csrf = assigned.data.csrf;
  assert.equal(assigned.data.spaces.length, 1);
  assert.equal(assigned.data.spaces[0].id, session.id);
  assert.deepEqual(
    Object.keys(assigned.data.spaces[0]).sort(),
    [
      "id",
      "title",
      "startsAt",
      "timezone",
      "recordingUrl",
      "postUrl",
      "participants",
      "spaceData",
    ].sort(),
  );
  const sharedParticipant = assigned.data.spaces[0].participants[0];
  assert.deepEqual(Object.keys(sharedParticipant.founder).sort(), [
    "country",
    "id",
    "name",
  ]);
  assert.deepEqual(Object.keys(sharedParticipant.company).sort(), [
    "id",
    "name",
  ]);
  assert.equal((await request("/api/auth/me", undefined, manager)).status, 401);
  assert.equal(
    (await request("/api/workspace", undefined, manager)).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/workspace",
        { type: "booking.review", payload: { id: "b1", status: "Approved" } },
        manager,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/space-managers",
        {
          action: "invite",
          email: "other@example.invalid",
          sessionIds: [session.id],
        },
        manager,
      )
    ).status,
    401,
  );
  for (const path of [
    "/dashboard",
    "/reports",
    "/campaigns",
    "/settings",
    "/companies",
    "/founders",
  ]) {
    assert.equal(
      (
        await fetch(origin + path, {
          headers: { Cookie: manager.cookie },
          redirect: "manual",
        })
      ).status,
      307,
      path,
    );
  }
  pass(
    "Manager invitation email accepted by a mock provider; single-use passwordless login is isolated from Admin routes and redacts contacts",
  );
  const managerPayload = {
    sessionId: session.id,
    liveListeners: 142,
    durationMinutes: 135,
    recordingUrl: "https://x.com/i/spaces/manager-recording",
    postUrl: "https://x.com/founders/status/123",
  };
  assert.equal(
    (await request("/api/manager/save", managerPayload, manager, false)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/manager/save",
        { ...managerPayload, sessionId: "up1" },
        manager,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/manager/save",
        { ...managerPayload, notes: "Private overwrite" },
        manager,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/manager/save",
        { ...managerPayload, submit: true },
        manager,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/manager/save",
        {
          ...managerPayload,
          teams: [{ companyId: "c1", foundersCount: 99, otherTeamCount: 99 }],
        },
        manager,
      )
    ).status,
    400,
  );
  const attendanceBefore = JSON.stringify(
    (await request("/api/workspace", undefined, admin)).data.state
      .spaceAttendance,
  );
  const managerSave = await request(
    "/api/manager/save",
    managerPayload,
    manager,
  );
  assert.equal(managerSave.status, 200, JSON.stringify(managerSave.data));
  assert.equal(
    (await request("/api/manager/save", managerPayload, manager)).status,
    200,
  );
  state = (await request("/api/workspace", undefined, admin)).data.state;
  assert.equal(
    state.spaceData.filter((r) => r.sessionId === session.id).length,
    1,
  );
  const managedRecord = state.spaceData.find(
    (r) => r.sessionId === session.id,
  )!;
  assert.equal(managedRecord.durationMinutes, 135);
  assert.equal(JSON.stringify(state.spaceAttendance), attendanceBefore);
  assert.equal(managedRecord.liveListeners, 142);
  assert.equal(managedRecord.notes, "Host attendance count");
  assert.equal(
    state.participants.filter((p) => p.sessionId === session.id).length,
    participants.length,
  );
  for (const p of participants) {
    assert.equal(
      founderSessions(state, p.founderId).find(
        (s) => s.session.id === session.id,
      )?.session.recordingUrl,
      managerPayload.recordingUrl,
    );
    assert.equal(
      companySessions(state, p.companyId).find((s) => s.id === session.id)
        ?.postUrl,
      managerPayload.postUrl,
    );
  }
  assert.equal(
    (
      await adminManagerRequest({
        action: "assign",
        id: managerId,
        sessionIds: [],
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/manager/save", managerPayload, manager)).status,
    403,
  );
  assert.equal(
    (
      await adminManagerRequest({
        action: "assign",
        id: managerId,
        sessionIds: [session.id],
      })
    ).status,
    200,
  );
  pass(
    "Manager saves reuse one shared Space record, preserve notes/bookings and update participating founder/company profiles; assignment removal applies immediately",
  );
  // A rejected provider response never produces a usable authentication link.
  rejectEmail = true;
  assert.equal(
    (await adminManagerRequest({ action: "resend", id: managerId })).status,
    502,
  );
  assert.equal(
    (await request("/api/manager/verify", { token: emailToken() })).status,
    401,
  );
  rejectEmail = false;
  assert.equal(
    (await adminManagerRequest({ action: "resend", id: managerId })).status,
    200,
  );
  const expiredToken = emailToken();
  const managerPolicyDb = new Client({ connectionString: url.toString() });
  await managerPolicyDb.connect();
  await managerPolicyDb.query(
    `UPDATE "SpaceManagerLink" SET "expiresAt"=NOW()-INTERVAL '1 minute' WHERE "tokenHash"=$1`,
    [createHash("sha256").update(expiredToken).digest("hex")],
  );
  assert.equal(
    (await request("/api/manager/verify", { token: expiredToken })).status,
    401,
  );
  await managerPolicyDb.query(
    `UPDATE "SpaceManagerSession" SET "expiresAt"=NOW()-INTERVAL '1 minute' WHERE "managerId"=$1`,
    [managerId],
  );
  assert.equal(
    (await request("/api/manager/spaces", undefined, manager)).status,
    401,
  );
  await managerPolicyDb.end();
  assert.equal(
    (await adminManagerRequest({ action: "resend", id: managerId })).status,
    200,
  );
  const concurrentToken = emailToken();
  const freshManager: Jar = { cookie: "", csrf: "" };
  const simultaneous = await Promise.all([
    request("/api/manager/verify", { token: concurrentToken }, manager),
    request("/api/manager/verify", { token: concurrentToken }, freshManager),
  ]);
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 401]);
  if (simultaneous[1].status === 200) manager.cookie = freshManager.cookie;
  manager.csrf = (
    await request("/api/manager/spaces", undefined, manager)
  ).data.csrf;
  assert.equal(
    (await adminManagerRequest({ action: "resend", id: managerId })).status,
    200,
  );
  const browserManagerToken = emailToken();
  const managerBrowser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const managerContext = await managerBrowser.newContext({
      viewport: { width: 393, height: 852 },
    });
    const page = await managerContext.newPage();
    await page.goto(origin + "/manager/spaces#token=" + browserManagerToken);
    await page
      .getByRole("button", { name: "Continue securely", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save Space data", exact: true })
      .waitFor();
    assert.equal(new URL(page.url()).hash, "");
    assert.equal(
      await page.getByText("Founders attended", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByText("Other team members", { exact: true }).count(),
      0,
    );
    await page.getByLabel("Live listeners", { exact: true }).fill("143");
    await page
      .getByRole("button", { name: "Save Space data", exact: true })
      .click();
    await page
      .getByText(
        "Space data saved. Shared founder and company profiles are updated.",
      )
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.mouse.move(0, 0);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    assert.deepEqual(
      accessibility.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
      [],
    );
    await page.screenshot({
      path: "artifacts/space-manager-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "artifacts/space-manager-desktop.png",
      fullPage: true,
    });
  } finally {
    await managerBrowser.close();
  }
  assert.equal(
    (await adminManagerRequest({ action: "resend", id: managerId })).status,
    200,
  );
  const futureToken = emailToken();
  const managerCookie = manager.cookie;
  assert.equal(
    (await adminManagerRequest({ action: "revoke", id: managerId })).status,
    200,
  );
  assert.equal(
    (await request("/api/manager/spaces", undefined, manager)).status,
    401,
  );
  assert.equal(
    (await request("/api/manager/save", managerPayload, manager)).status,
    401,
  );
  assert.equal(
    (await request("/api/manager/verify", { token: futureToken })).status,
    401,
  );
  assert.equal(
    (
      await request("/api/manager/spaces", undefined, {
        cookie: managerCookie,
        csrf: "",
      })
    ).status,
    401,
  );
  assert.equal(
    (await adminManagerRequest({ action: "resend", id: managerId })).status,
    401,
  );
  managerList = (await request("/api/space-managers", undefined, admin)).data
    .managers;
  assert.equal(
    managerList.find((m: { id: string }) => m.id === managerId).status,
    "Revoked",
  );
  assert.ok(
    managerList.find((m: { id: string }) => m.id === managerId).lastActivityAt,
  );
  const unknownLink = await request("/api/manager/request-link", {
    email: "unknown@integration.example.invalid",
  });
  const revokedLink = await request("/api/manager/request-link", {
    email: managerEmail,
  });
  assert.equal(unknownLink.status, 200);
  assert.equal(revokedLink.status, 200);
  assert.deepEqual(unknownLink.data, revokedLink.data);

  state = (await request("/api/workspace", undefined, admin)).data.state;
  assert.equal(
    state.spaceData.find((r) => r.sessionId === session.id)!.liveListeners,
    143,
  );
  assert.ok(state.audit.some((a) => a.action === "manager.revoke"));
  assert.ok(state.audit.some((a) => a.action === "manager.space.save"));
  assert.equal((await request("/api/auth/me", undefined, admin)).status, 200);
  pass(
    "Light mobile manager workflow saves successfully; provider rejection is honest; revocation rejects active sessions and unused links while preserving edits and Admin access",
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
  const legacyTerms =
    "Historical programme policy: One eligible founder may receive 1 SOL.";
  await consentDb.query(
    `UPDATE "Setting" SET value=jsonb_set(value::jsonb, '{terms}', to_jsonb($1::text)) WHERE key='programme'`,
    [legacyTerms],
  );
  const withoutConsent = await request("/api/public/programme");
  assert.equal(withoutConsent.data.settings.terms, PARTICIPATION_TERMS);
  assert.ok(!("awardAmount" in withoutConsent.data.settings));
  assert.ok(!("campaignTarget" in withoutConsent.data.settings));
  const retainedPolicy = await consentDb.query(
    `SELECT value FROM "Setting" WHERE key='programme'`,
  );
  assert.equal(retainedPolicy.rows[0].value.terms, legacyTerms);

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
  const { reportData, blankFilters } =
    await import("@/features/reports/lib/selectors");
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
    await page.goto(origin + "/settings");
    await page
      .getByRole("button", { name: "Space Managers", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Space Managers", exact: true })
      .waitFor();
    await page
      .locator(".space-managers-settings")
      .getByRole("cell")
      .filter({ hasText: managerEmail })
      .first()
      .waitFor();
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: "artifacts/space-manager-settings-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  pass(
    "Production mobile sign-in, private dashboard and newly approved founder profile render without runtime errors",
  );
  // Attendance-gated cycles: isolated past-session fixtures, never production records.
  const cycleDb = new Client({ connectionString: url.toString() });
  await cycleDb.connect();
  const cycleIds: string[] = [];
  for (let i = 0; i < 8; i++) {
    const date = new Date("2026-10-03T19:00:00Z");
    date.setUTCDate(date.getUTCDate() + i * 7);
    state = await command("session.save", {
      ...sessionPayload,
      id: undefined,
      title: `Attendance cycle week ${i + 1}`,
      startsAt: date.toISOString(),
      deadline: date.toISOString(),
      timezone: "Europe/London",
    });
    const id = state.sessions.find(
      (s) => s.title === `Attendance cycle week ${i + 1}`,
    )!.id;
    cycleIds.push(id);
    await cycleDb.query(
      'INSERT INTO "SessionParticipant"(id,"sessionId","founderId","companyId",speakers,attendance) VALUES($1,$2,$3,$4,1,$5)',
      [crypto.randomUUID(), id, "f1", "c1", "Approved"],
    );
  }
  await cycleDb.query('DELETE FROM "ProgrammeWeek"');
  await cycleDb.query(
    'UPDATE "ProgrammeSchedule" SET "anchorDay"=$1,"activeStart"=0 WHERE id=$2',
    ["2026-10-03", "main"],
  );
  for (let i = 0; i < 8; i++)
    await cycleDb.query(
      'INSERT INTO "ProgrammeWeek"("sessionId",position) VALUES($1,$2)',
      [cycleIds[i], i],
    );
  const attendance = (sessionId: string, submit: boolean) => ({
    sessionId,
    submit,
    postUrl: "https://x.com/founders/status/cycle",
    liveListeners: 100,
    durationMinutes: 60,
    notes: "Actual attendance",
    teams: [{ companyId: "c1", foundersCount: 1, otherTeamCount: 0 }],
  });
  await command("space-data.save", {
    ...attendance(cycleIds[0], false),
    teams: [],
  });
  assert.equal(
    (
      await cycleDb.query(
        'SELECT "activeStart" FROM "ProgrammeSchedule" WHERE id=$1',
        ["main"],
      )
    ).rows[0].activeStart,
    0,
  );
  assert.equal(
    (
      await adminManagerRequest({
        action: "invite",
        email: "cycle-manager@integration.example.invalid",
        sessionIds: [cycleIds[0]],
      })
    ).status,
    201,
  );
  const cycleManager: Jar = { cookie: "", csrf: "" };
  assert.equal(
    (
      await request(
        "/api/manager/verify",
        { token: emailToken() },
        cycleManager,
      )
    ).status,
    200,
  );
  cycleManager.csrf = (
    await request("/api/manager/spaces", undefined, cycleManager)
  ).data.csrf;
  const { notes: ignoredNotes, ...managerAttendance } = attendance(
    cycleIds[0],
    true,
  );
  void ignoredNotes;
  const { teams: ignoredTeams, ...cycleReport } = managerAttendance;
  void ignoredTeams;
  assert.equal(
    (await request("/api/manager/save", cycleReport, cycleManager)).status,
    200,
  );
  await command("space-data.save", attendance(cycleIds[0], true));
  await command("space-data.save", attendance(cycleIds[0], true));
  assert.equal(
    (
      await cycleDb.query(
        'SELECT "activeStart" FROM "ProgrammeSchedule" WHERE id=$1',
        ["main"],
      )
    ).rows[0].activeStart,
    0,
  );
  await command("space-data.save", attendance(cycleIds[1], true));
  await command("space-data.save", attendance(cycleIds[2], true));
  assert.equal(
    (
      await cycleDb.query(
        'SELECT "activeStart" FROM "ProgrammeSchedule" WHERE id=$1',
        ["main"],
      )
    ).rows[0].activeStart,
    0,
  );
  const retainedBookingIds = (
    await cycleDb.query('SELECT id FROM "BookingRequest" ORDER BY id')
  ).rows.map((r) => r.id);
  await command("space-data.save", attendance(cycleIds[3], true));
  await command("space-data.save", attendance(cycleIds[3], true));
  assert.equal(
    (
      await cycleDb.query(
        'SELECT "activeStart" FROM "ProgrammeSchedule" WHERE id=$1',
        ["main"],
      )
    ).rows[0].activeStart,
    4,
  );
  const publicWindow = await request("/api/public/sessions");
  assert.equal(publicWindow.data.sessions.length, 8);
  assert.ok(
    publicWindow.data.sessions.every(
      (s: { position: number }) => s.position >= 4 && s.position < 12,
    ),
  );
  assert.ok(
    !publicWindow.data.sessions.some((s: { id: string }) =>
      cycleIds.slice(0, 4).includes(s.id),
    ),
  );
  assert.equal(
    (await cycleDb.query('SELECT count(*)::int AS n FROM "ProgrammeWeek"'))
      .rows[0].n,
    12,
  );
  assert.equal(
    (
      await cycleDb.query(
        'SELECT count(*)::int AS n FROM "SpaceData" WHERE "sessionId"=ANY($1::text[]) AND "submittedAt" IS NOT NULL',
        [cycleIds.slice(0, 4)],
      )
    ).rows[0].n,
    4,
  );
  assert.deepEqual(
    (
      await cycleDb.query('SELECT id FROM "BookingRequest" ORDER BY id')
    ).rows.map((r) => r.id),
    retainedBookingIds,
  );
  assert.equal(
    (
      await request("/api/public/book", {
        token: capability,
        sessionId: session.id,
      })
    ).status,
    409,
  );
  await cycleDb.end();
  pass(
    "Eight-week season advances once after four distinct submitted Spaces; drafts/repeated saves do not count, archived history and booking IDs remain intact, and out-of-season bookings are rejected",
  );
  const deletionDb = new Client({ connectionString: url.toString() });
  deletionDb.on("error", () => {});
  await deletionDb.connect();
  async function historicalAwards() {
    return {
      campaigns: (
        await deletionDb.query('SELECT * FROM "Campaign" ORDER BY id')
      ).rows,
      participants: (
        await deletionDb.query(
          'SELECT * FROM "CampaignParticipant" ORDER BY "campaignId", "founderId"',
        )
      ).rows,
      awards: (
        await deletionDb.query('SELECT * FROM "AwardDecision" ORDER BY id')
      ).rows,
    };
  }
  // Non-empty payment/evidence values prove retirement does not erase old obligations.
  await deletionDb.query(
    'UPDATE "AwardDecision" SET "transactionReference"=$1, status=$2 WHERE id=$3',
    ["historical-payment-reference", "Paid", "award1"],
  );
  const historicalBefore = await historicalAwards();
  assert.ok(historicalBefore.awards.length > 0);
  assert.equal(
    (
      await request("/api/monthly-winner", {
        period: "2026-10",
        founderId: "f1",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/monthly-winner",
        { period: "2026-10", founderId: "f1" },
        manager,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/monthly-winner",
        { period: "2026-10", founderId: "f1" },
        admin,
        false,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/monthly-winner",
        { period: "2026-10", founderId: "f2" },
        admin,
      )
    ).status,
    410,
  );
  for (const type of RETIRED_AWARD_COMMANDS) {
    assert.equal(
      (await request("/api/workspace", { type, payload: {} })).status,
      401,
    );
    assert.equal(
      (await request("/api/workspace", { type, payload: {} }, manager)).status,
      401,
    );
    assert.equal(
      (await request("/api/workspace", { type, payload: {} }, admin, false))
        .status,
      403,
    );
    assert.equal(
      (await request("/api/workspace", { type, payload: {} }, admin)).status,
      410,
    );
  }
  assert.deepEqual(await historicalAwards(), historicalBefore);
  state = await command("founder.save", {
    ...state.founders[0],
    id: undefined,
    name: "Delete UI Fixture",
    xHandle: "delete_ui_fixture",
  });
  const uiFounder = state.founders.find(
    (f) => f.xHandle === "delete_ui_fixture",
  )!;
  const finalBrowser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  });
  try {
    const page = await finalBrowser.newPage({
      viewport: { width: 393, height: 852 },
    });
    await page.goto(origin + "/signin");
    await page.getByLabel("Email").fill(env.BOOTSTRAP_ADMIN_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page.goto(origin + "/campaigns");
    await page
      .getByRole("heading", { name: "Founder award archive", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Save winner", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("navigation")
        .getByRole("link", { name: /Monthly winner/ })
        .count(),
      0,
    );
    await page
      .getByRole("cell", { name: "1 SOL", exact: true })
      .first()
      .waitFor();
    await page
      .getByRole("cell", { name: "historical-payment-reference", exact: true })
      .waitFor();
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: "artifacts/v4-award-archive-mobile.png",
      fullPage: true,
    });
    await page.goto(origin + "/founders/" + uiFounder.id);
    await page
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await page.waitForURL("**/founders");
  } finally {
    await finalBrowser.close();
  }
  assert.equal(
    (
      await deletionDb.query(
        'SELECT count(*)::int AS n FROM "Founder" WHERE id=$1',
        [uiFounder.id],
      )
    ).rows[0].n,
    0,
  );
  const declined = await request("/api/public/apply", {
    ...application,
    founderName: "Delete Declined",
    companyName: "Deleted Declined Project",
    xHandle: "delete_declined",
    contact: "delete-only@example.invalid",
  });
  assert.equal(declined.status, 201);
  state = (await request("/api/workspace", undefined, admin)).data.state;
  const declinedApp = state.applications.find(
    (a) => a.reference === declined.data.reference,
  )!;
  await command("application.review", {
    id: declinedApp.id,
    status: "Declined",
  });
  assert.equal(
    (
      await request(
        "/api/records",
        { kind: "application", id: declinedApp.id, confirmation: "DELETE" },
        undefined,
        true,
        "DELETE",
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/records",
        { kind: "application", id: declinedApp.id, confirmation: "DELETE" },
        manager,
        true,
        "DELETE",
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/records",
        { kind: "application", id: declinedApp.id, confirmation: "DELETE" },
        admin,
        false,
        "DELETE",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/records",
        { kind: "application", id: declinedApp.id, confirmation: "wrong" },
        admin,
        true,
        "DELETE",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "/api/records",
        { kind: "application", id: declinedApp.id, confirmation: "DELETE" },
        admin,
        true,
        "DELETE",
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/public/confirmation", { token: declined.data.token }))
      .status,
    404,
  );
  const sharedSessionId = session.id;
  assert.equal(
    (
      await request(
        "/api/records",
        { kind: "founder", id: linked.founderId, confirmation: "DELETE" },
        admin,
        true,
        "DELETE",
      )
    ).status,
    200,
  );
  for (const [table, column, value] of [
    ["Founder", "id", linked.founderId],
    ["Application", "founderId", linked.founderId],
    ["BookingRequest", "applicationId", app.id],
    ["Company", "id", linked.companyId],
  ] as const) {
    const found = await deletionDb.query(
      `SELECT count(*)::int AS n FROM "${table}" WHERE "${column}"=$1`,
      [value],
    );
    assert.equal(found.rows[0].n, 0, table);
  }
  assert.equal(
    (
      await deletionDb.query(
        'SELECT count(*)::int AS n FROM "Session" WHERE id=$1',
        [sharedSessionId],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await deletionDb.query(
        'SELECT count(*)::int AS n FROM "SpaceData" WHERE "sessionId"=$1',
        [sharedSessionId],
      )
    ).rows[0].n,
    1,
  );
  assert.ok(
    (
      await deletionDb.query(
        'SELECT count(*)::int AS n FROM "SessionParticipant" WHERE "sessionId"=$1',
        [sharedSessionId],
      )
    ).rows[0].n > 0,
  );
  assert.equal(
    (await request("/api/public/confirmation", { token: capability })).status,
    404,
  );
  await deletionDb.end();
  pass(
    "Historical award rows survive archive reads and rejected writes; permanent founder/application deletion revokes confirmations, removes owned data and preserves shared Spaces, with Admin-only CSRF checks",
  );
  const oldCookie = admin.cookie;
  assert.equal(
    (await request("/api/auth/logout", {}, admin, false)).status,
    403,
  );
  assert.equal((await request("/api/auth/logout", {}, admin)).status, 200);
  assert.equal(
    (
      await request("/api/workspace", undefined, {
        cookie: oldCookie,
        csrf: "",
      })
    ).status,
    401,
  );
  assert.equal((await request("/api/auth/me", undefined, admin)).status, 401);
  pass(
    "Logout requires CSRF and revokes the database session, including replay of its old cookie",
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
  await new Promise<void>((resolve) => mailServer.close(() => resolve()));
}
