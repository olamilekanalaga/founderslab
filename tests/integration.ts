/** Isolated PostgreSQL + production HTTP verification. Never resets an existing database. */
// PostgreSQL timestamp columns store UTC; pg's standalone parser otherwise uses the Windows host timezone.
process.env.TZ = "UTC";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import {
  saturdaySessions,
  isLondonProgrammeTime,
} from "@/lib/dates/saturday-schedule";
import { rewardSummary } from "@/features/bd-partners/rewards";
import type { DataState } from "@/lib/types";
import {
  PARTICIPATION_TERMS,
  RETIRED_AWARD_COMMANDS,
} from "@/lib/programme-policy";
const artifactDir = process.env.TEST_ARTIFACT_DIR || "artifacts";
mkdirSync(artifactDir, { recursive: true });
const artifactPath = (name: string) => join(artifactDir, name);
try {
  process.loadEnvFile(".env");
} catch {}
const source = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!source)
  throw new Error(
    "Set TEST_DATABASE_URL to a local PostgreSQL server with database-creation privileges.",
  );
const url = new URL(source);
// Make NOW() fixtures agree with UTC timestamp storage on the local Windows PostgreSQL server.
url.searchParams.set("options", "-c timezone=UTC");
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
  assert.match(
    String(req.headers["idempotency-key"]),
    /^space-manager\/[a-f0-9]{64}$/,
  );
  assert.equal(req.method, "POST");
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
  BD_BANK_ENCRYPTION_KEY: "",
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
  // Exercise the additive migration on populated, pre-change tables in this disposable DB.
  const legacyDb = new Client({ connectionString: url.toString() });
  await legacyDb.connect();
  await legacyDb.query(
    'CREATE TABLE "_founders_migrations" (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of readdirSync("prisma/migrations")
    .sort()
    .filter(
      (name) =>
        name < "202611220004_project_x_identity" && !name.endsWith(".toml"),
    )) {
    const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8");
    await legacyDb.query(sql);
    await legacyDb.query(
      'INSERT INTO "_founders_migrations"(name, checksum) VALUES($1,$2)',
      [name, createHash("sha256").update(sql).digest("hex")],
    );
  }
  await legacyDb.query(
    `INSERT INTO "Founder" (id,name,"xHandle",country,contact,"updatedAt") VALUES ('legacy-f','Legacy founder','legacy_personal','United Kingdom','private@example.invalid',now())`,
  );
  await legacyDb.query(
    `INSERT INTO "Company" (id,name,description,website,country,"operatingCountries","teamSize",stage,sector,"economicFunctions",customers,"businessModels",ecosystems,chains,integrations,distribution,"updatedAt") VALUES ('legacy-c','Legacy company','Existing description','https://legacy.example.invalid','United Kingdom','{}','2–5','MVP','Payments','{}','{}','{}','{}','{}','{}','{}',now())`,
  );
  await legacyDb.query(
    `INSERT INTO "Application" (id,reference,"dedupeKey","founderName","companyName","xHandle",website,country,description,speakers,"teamSize",stage,sector,focus,"teamCountries","privacyConsent","confirmationHash","confirmationExpires","updatedAt") VALUES ('legacy-a','LEGACY-REFERENCE','legacy-key','Legacy founder','Legacy company','legacy_personal','https://legacy.example.invalid','United Kingdom','Existing description',1,'2–5','MVP','Payments','Existing focus','{}',true,'legacy-confirmation-hash',now()+interval '1 day',now())`,
  );
  const originals: Record<string, Record<string, unknown>> = {};
  for (const table of ["Founder", "Company", "Application"])
    originals[table] = (
      await legacyDb.query(`SELECT * FROM "${table}"`)
    ).rows[0];
  run("scripts/migrate.ts");
  run("scripts/migrate.ts");
  for (const table of ["Founder", "Company", "Application"]) {
    const row = (await legacyDb.query(`SELECT * FROM "${table}"`)).rows[0];
    if (table === "Company") {
      assert.equal(row.xHandle, null);
      delete row.xHandle;
    }
    if (table === "Application") {
      assert.equal(row.projectXHandle, null);
      delete row.projectXHandle;
    }
    assert.deepEqual(row, originals[table]);
  }
  await legacyDb.query(`DELETE FROM "Application" WHERE id='legacy-a'`);
  await legacyDb.query(`DELETE FROM "Founder" WHERE id='legacy-f'`);
  await legacyDb.query(`DELETE FROM "Company" WHERE id='legacy-c'`);
  await legacyDb.end();
  pass(
    "Additive identity migration preserves existing founder/application usernames, contact data, confirmations and company records; new project identities remain NULL and migration is idempotent",
  );
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
        row.capacity === 4,
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
    "/operations",
    "/founders",
    "/founders/f1",
    "/companies",
    "/spaces",
    "/reports",
    "/settings",
    "/owner-invitations",
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
    xHandle: " @ ISOLATED_EXAMPLE ",
    projectXHandle: "@Isolated_Project",
    website: "isolated.example.invalid",
    country: "Nigeria",
    description: "Pay",
    speakers: 3,
    teamSize: "2–5",
    sector: "Payments",
    focus: "AI",
    founderRole: "Founder",
    ecosystem: " SOLANA , Base, solana ",
    hiring: false,
    comments: "None",
    privacyConsent: true,
    promotionalConsent: false,
  };
  assert.equal(
    (
      await request("/api/public/apply", {
        ...application,
        projectXHandle: undefined,
      })
    ).status,
    400,
  );
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
  assert.equal(linked.xHandle, "isolated_example");
  assert.equal(linked.projectXHandle, "isolated_project");
  assert.equal(linked.stage, "Live");
  assert.deepEqual(linked.teamCountries, []);
  assert.equal(linked.seeking, "");
  assert.equal(linked.ecosystem, "solana, base");
  assert.deepEqual(
    state.companies.find((c) => c.id === linked.companyId)!.chains,
    ["solana", "base"],
  );
  assert.equal(
    state.founders.find((f) => f.id === linked.founderId)!.xHandle,
    "isolated_example",
  );
  assert.equal(
    state.companies.find((c) => c.id === linked.companyId)!.xHandle,
    "isolated_project",
  );
  assert.equal(linked.website, "https://isolated.example.invalid");
  assert.equal(
    state.companies.find((c) => c.id === linked.companyId)?.website,
    "https://isolated.example.invalid",
  );
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
      "spaceData",
    ].sort(),
  );
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
    "/settings",
    "/owner-invitations",
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
  assert.equal(
    (
      await adminManagerRequest({
        action: "assign",
        id: managerId,
        allSpaces: true,
        sessionIds: [],
      })
    ).status,
    200,
  );
  const managerWorkspace = await request("/api/workspace", undefined, manager);
  assert.equal(managerWorkspace.status, 200);
  assert.equal(managerWorkspace.data.viewer.roleId, "space-manager");
  assert.deepEqual(managerWorkspace.data.state.users, []);
  assert.deepEqual(managerWorkspace.data.state.audit, []);
  assert.equal(
    (await request("/api/space-managers", undefined, manager)).status,
    401,
  );
  assert.equal(
    (await request("/api/bd-partners", undefined, manager)).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/api/workspace",
        { type: "user.permissions", payload: {} },
        manager,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/workspace",
        { type: "booking.review", payload: {} },
        manager,
        false,
      )
    ).status,
    403,
  );
  const approved = managerWorkspace.data.state.bookings.find(
    (booking: DataState["bookings"][number]) =>
      booking.sessionId === session.id && booking.status === "Approved",
  );
  assert.ok(approved);
  await command(
    "booking.review",
    { id: approved.id, status: "Approved" },
    manager,
  );
  const operationsManagerBrowser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const managerPage = await operationsManagerBrowser.newPage({
      viewport: { width: 393, height: 852 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await managerPage.clock.setFixedTime(new Date("2026-12-25T15:00:00Z"));
    await managerPage.context().addCookies([
      {
        name: "fl_space_manager",
        value: manager.cookie.split("=")[1],
        url: origin,
      },
    ]);
    await managerPage.goto(origin + "/manager/spaces");
    await managerPage.waitForURL("**/dashboard");
    const lineup = managerPage.getByRole("region", {
      name: "Confirmed founder lineup",
    });
    await lineup.getByRole("button", { name: "Copy lineup" }).click();
    await lineup.getByText("Lineup copied.").waitFor();
    const copied = await managerPage.evaluate(() =>
      navigator.clipboard.readText(),
    );
    const application = managerWorkspace.data.state.applications.find(
      (record: DataState["applications"][number]) =>
        record.id === approved.applicationId,
    );
    assert.ok(copied.includes(application.companyName));
    assert.ok(copied.includes(application.description));
    assert.ok(copied.includes("@" + application.xHandle.replace(/^@+/, "")));
    await lineup.getByRole("button", { name: "Next Saturday" }).click();
    assert.match(await lineup.innerText(), /2 January 2027/);
    assert.equal(await managerPage.getByText("Manage invitations").count(), 0);
    await managerPage
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("link", { name: /Admin operations/ })
      .click();
    await managerPage.getByLabel("BD X handle").waitFor();
  } finally {
    await operationsManagerBrowser.close();
  }
  const subsequentSpace = await command("session.save", {
    ...sessionPayload,
    id: undefined,
    title: "Created after granting all Spaces",
    startsAt: "2028-01-01T19:00:00Z",
    deadline: "2028-01-01T19:00:00Z",
  });
  const futureId = subsequentSpace.sessions.find(
    (s) => s.title === "Created after granting all Spaces",
  )!.id;
  const allAssigned = await request("/api/manager/spaces", undefined, manager);
  assert.ok(
    allAssigned.data.spaces.some(
      (space: { id: string }) => space.id === futureId,
    ),
  );
  assert.equal(
    (
      await request(
        "/api/manager/save",
        {
          ...managerPayload,
          sessionId: futureId,
          recordingUrl: "x.com",
          postUrl: "x.com/example/status/123",
        },
        manager,
      )
    ).status,
    200,
  );
  const updated = await request("/api/manager/spaces", undefined, manager);
  assert.equal(
    updated.data.spaces.find((space: { id: string }) => space.id === futureId)
      .recordingUrl,
    "https://x.com",
  );
  assert.equal(
    updated.data.spaces.find((space: { id: string }) => space.id === futureId)
      .postUrl,
    "https://x.com/example/status/123",
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
  assert.equal(
    (
      await request(
        "/api/manager/save",
        { ...managerPayload, sessionId: futureId },
        manager,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/workspace", undefined, manager)).status,
    401,
  );
  assert.equal(
    (await request("/api/bd-partners", undefined, manager)).status,
    401,
  );
  pass(
    "All-Spaces managers can copy confirmed founder lineups and run operations. Narrowing access blocks the full workspace and BD records.",
  );
  const managerBd = {
    name: "zz_manager_bd",
    email: "manager-entered-bd@example.invalid",
    bank: "Test bank",
    accountName: "Manager-entered partner",
    accountNumber: "0123456789",
  };
  assert.equal(
    (await request("/api/manager/register-bd", managerBd)).status,
    401,
  );
  assert.equal(
    (await request("/api/manager/register-bd", managerBd, manager, false))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/manager/register-bd",
        { ...managerBd, paid: true },
        manager,
      )
    ).status,
    400,
  );
  const managerRegistration = await request(
    "/api/manager/register-bd",
    managerBd,
    manager,
  );
  assert.equal(managerRegistration.status, 200);
  assert.deepEqual(managerRegistration.data, { saved: true });
  assert.equal(
    (await request("/api/bd-partners", undefined, manager)).status,
    401,
  );
  const ownerPartners = await request("/api/bd-partners", undefined, admin);
  assert.ok(
    ownerPartners.data.some(
      (partner: { email: string; name: string }) =>
        partner.email === managerBd.email && partner.name === "@zz_manager_bd",
    ),
  );
  pass(
    "A manager may register a BD partner without reading saved records or recording payments",
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
  const mobileAttendanceDb = new Client({ connectionString: url.toString() });
  await mobileAttendanceDb.connect();
  const originalSpace = (
    await mobileAttendanceDb.query(
      'SELECT "startsAt", status FROM "Session" WHERE id=$1',
      [session.id],
    )
  ).rows[0];
  await mobileAttendanceDb.query(
    'UPDATE "Session" SET "startsAt"=$1 WHERE id=$2',
    [new Date(Date.now() - 3600000), session.id],
  );
  const managerBrowser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
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
    await page.getByRole("button", { name: "BD data", exact: true }).click();
    await page
      .getByRole("heading", { name: "Add approved BD partner" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Submit attendance", exact: true })
        .isVisible(),
      false,
    );
    await page.getByRole("button", { name: "Space data", exact: true }).click();
    assert.equal(
      await page
        .getByRole("heading", { name: "Add approved BD partner" })
        .isVisible(),
      false,
    );
    await page
      .getByRole("button", { name: "Submit attendance", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Save Space data", exact: true })
        .count(),
      0,
    );
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
      .getByRole("button", { name: "Submit attendance", exact: true })
      .click();
    await page
      .getByText(
        "Space data saved. Shared founder and company profiles are updated.",
      )
      .waitFor();
    const saved = (
      await mobileAttendanceDb.query(
        'SELECT "liveListeners", "submittedAt" FROM "SpaceData" WHERE "sessionId"=$1',
        [session.id],
      )
    ).rows[0];
    assert.equal(saved.liveListeners, 143);
    assert.ok(saved.submittedAt);
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
      path: artifactPath("space-manager-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: artifactPath("space-manager-desktop.png"),
      fullPage: true,
    });
  } finally {
    await managerBrowser.close();
    await mobileAttendanceDb.query(
      'UPDATE "Session" SET "startsAt"=$1, status=$2 WHERE id=$3',
      [originalSpace.startsAt, originalSpace.status, session.id],
    );
    await mobileAttendanceDb.query(
      'UPDATE "SpaceData" SET "submittedAt"=NULL, "submittedBy"=NULL WHERE "sessionId"=$1',
      [session.id],
    );
    await mobileAttendanceDb.end();
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
    const reviewContext = await browser.newContext({
      viewport: { width: 393, height: 852 },
      timezoneId: "Africa/Lagos",
    });
    const page = await reviewContext.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/signin");
    await page.getByLabel("Email").fill(env.BOOTSTRAP_ADMIN_EMAIL);
    const passwordInput = page.getByLabel("Password", { exact: true });
    await passwordInput.fill(password);
    assert.equal(await passwordInput.getAttribute("type"), "password");
    await page.getByRole("button", { name: "Show password" }).click();
    assert.equal(await passwordInput.getAttribute("type"), "text");
    assert.ok((await passwordInput.inputValue()) === password);
    await page.getByRole("button", { name: "Hide password" }).click();
    assert.equal(await passwordInput.getAttribute("type"), "password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page.locator(".desk-grid").waitFor();
    await page.screenshot({
      path: artifactPath("admin-desk-populated-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1358, height: 644 });
    await page.mouse.move(0, 0);
    const populatedCards = await page
      .locator(".desk-grid > *")
      .evaluateAll((cards) =>
        cards.map((card) => ({
          class: card.className,
          height: card.clientHeight,
          scroll: card.scrollHeight,
        })),
      );
    assert.ok(
      populatedCards.every((c) => c.scroll <= c.height + 2),
      JSON.stringify(populatedCards.filter((c) => c.scroll > c.height + 2)),
    );
    await page.screenshot({
      path: artifactPath("admin-desk-populated-laptop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 393, height: 852 });
    await page.locator(".desk-queue .desk-queue-row").first().click();
    await page.getByRole("dialog").waitFor();
    assert.equal(
      await page.getByRole("dialog").evaluate((el) => el.isConnected),
      true,
      "Client navigation opens review in the current workspace",
    );
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.goto(origin + `/operations?tab=applications&review=${app.id}`);
    const fullReview = page.getByRole("dialog");
    await fullReview.waitFor();
    for (const label of [
      "Founder role",
      "Team countries",
      "Hiring",
      "Applicant comments",
      "Blockchain / chain",
    ])
      assert.ok(
        await fullReview.getByText(label, { exact: true }).count(),
        `Complete submitted field: ${label}`,
      );
    await page.screenshot({
      path: artifactPath("admin-desk-full-review-mobile.png"),
      fullPage: false,
    });
    const reviewAxe = await new AxeBuilder({ page })
      .include(".application-dialog")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    writeFileSync(
      artifactPath("full-review-accessibility.json"),
      JSON.stringify(
        reviewAxe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        null,
        2,
      ),
    );
    assert.deepEqual(
      reviewAxe.violations,
      [],
      "Populated full application review is accessible on mobile",
    );
    await fullReview.getByRole("table", { name: "Project answers" }).waitFor();
    assert.equal(
      await fullReview
        .getByRole("button", { name: "Assign session", exact: true })
        .count(),
      0,
    );
    await page.keyboard.press("Escape");
    await page.goto(origin + "/dashboard");
    const [nextSaturday] = saturdaySessions(new Date(), 1);
    const cardState = structuredClone(state);
    const mobileSpace = {
      ...cardState.sessions[0],
      id: nextSaturday.id,
      startsAt: nextSaturday.startsAt.toISOString(),
      capacity: 12,
      status: "Scheduled",
    };
    cardState.sessions = [mobileSpace];
    cardState.participants = [];
    await page.route("**/api/workspace", (route) =>
      route.fulfill({ json: { state: cardState } }),
    );
    await page.reload();
    await page.locator(".desk-details > summary").click();
    const saturdayCard = page.getByRole("region", {
      name: "Saturday Founder Space",
    });
    await saturdayCard
      .getByText("No projects booked yet.", { exact: false })
      .waitFor();
    assert.equal(
      await saturdayCard.locator(".current-saturday-slots span").count(),
      12,
    );
    assert.equal(
      await saturdayCard
        .getByRole("link", { name: "View Bookings" })
        .getAttribute("href"),
      "/spaces?tab=bookings&session=" + mobileSpace.id,
    );
    assert.equal(
      await saturdayCard.evaluate(
        (card) =>
          card.getBoundingClientRect().right <= window.innerWidth &&
          card.scrollWidth <= card.clientWidth,
      ),
      true,
    );
    await page.unroute("**/api/workspace");
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
      path: artifactPath("private-founder-mobile.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Edit founder", exact: true })
      .click();
    await page
      .getByLabel("Founder X", { exact: true })
      .fill("@Corrected_Personal");
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.goto(origin + "/companies/" + linked.companyId);
    await page
      .getByRole("button", { name: "Edit company", exact: true })
      .click();
    await page
      .getByLabel("Project X", { exact: true })
      .fill("@Corrected_Project");
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const corrected = (await request("/api/workspace", undefined, admin)).data
      .state as DataState;
    assert.equal(
      corrected.founders.find((f) => f.id === linked.founderId)!.xHandle,
      "corrected_personal",
    );
    assert.equal(
      corrected.companies.find((c) => c.id === linked.companyId)!.xHandle,
      "corrected_project",
    );
    await page.goto(origin + "/owner-invitations");
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
      path: artifactPath("space-manager-settings-mobile.png"),
      fullPage: true,
    });
    const navigation = page.getByRole("navigation", {
      name: "Workspace navigation",
    });
    await navigation.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("heading", { name: "⭕️La_Crrypt💰₿" }).waitFor();
    assert.equal(
      await navigation
        .getByRole("link", { name: "Settings" })
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(
      await navigation.evaluate((bar) => bar.getBoundingClientRect().bottom),
      page.viewportSize()?.height,
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Programme website" })
        .getAttribute("href"),
      "/",
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).waitFor();
    await page.getByRole("button", { name: "Activity", exact: true }).click();
    const activity = page.getByRole("table", { name: "Recent audit activity" });
    await activity.getByRole("columnheader", { name: "Time (UTC)" }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const accountButton = page.getByRole("button", {
      name: /Open account menu/,
    });
    const portrait = accountButton.locator("img");
    await portrait.waitFor();
    await page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>(
        ".account-trigger img",
      );
      return image?.complete && image.naturalWidth > 0;
    });
    assert.equal(
      await page.getByRole("button", { name: "Refresh workspace" }).count(),
      0,
    );
    const workspaceUpdate = page.waitForResponse(
      (response) => response.url().endsWith("/api/workspace") && response.ok(),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await workspaceUpdate;
    await page.getByRole("button", { name: /Open account menu/ }).click();
    const account = page.getByRole("dialog", { name: "Your account" });
    await account.getByRole("button", { name: "Reduced effects" }).click();
    assert.equal(
      await account.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(255, 255, 255)",
    );
    assert.equal(
      await account.evaluate((el) => getComputedStyle(el).backdropFilter),
      "none",
    );
    await account.getByRole("button", { name: "Glass", exact: true }).click();
    assert.equal(
      await account.evaluate((el) => getComputedStyle(el).backdropFilter),
      "blur(10px)",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await account.getByRole("button", { name: "System", exact: true }).click();
    assert.equal(
      await account.evaluate((el) => getComputedStyle(el).backdropFilter),
      "none",
    );
    await page.reload();
    await page.getByRole("button", { name: /Open account menu/ }).click();
    assert.equal(
      await account
        .getByRole("button", { name: "System", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await account.getByRole("button", { name: "Close dialog" }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + "/spaces");
    await page
      .getByRole("button", { name: "Create Space", exact: true })
      .click();
    await page
      .getByLabel("Session title", { exact: true })
      .fill("Admin UTC acceptance");
    await page
      .getByLabel("Session starts · UTC", { exact: true })
      .fill("2030-01-05T19:00");
    await page
      .getByLabel("Application deadline · UTC", { exact: true })
      .fill("2030-01-05T18:00");
    assert.equal(
      await page
        .getByLabel("Session starts · UTC", { exact: true })
        .inputValue(),
      "2030-01-05T19:00",
    );
    const winterResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/workspace") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    const winterSave = await winterResponse;
    assert.equal(winterSave.status(), 200);
    const winterState = (await winterSave.json()).state as DataState;
    const utcSession = winterState.sessions.find(
      (s) => s.title === "Admin UTC acceptance",
    )!;
    assert.equal(utcSession.startsAt, "2030-01-05T19:00:00.000Z");
    await page.goto(origin + "/spaces/" + utcSession.id);
    await page
      .getByRole("button", { name: "Edit session & recording", exact: true })
      .click();
    assert.equal(
      await page
        .getByLabel("Session starts · UTC", { exact: true })
        .inputValue(),
      "2030-01-05T19:00",
    );
    await page
      .getByLabel("Session starts · UTC", { exact: true })
      .fill("2030-06-01T18:00");
    await page
      .getByLabel("Application deadline · UTC", { exact: true })
      .fill("2030-06-01T17:00");
    const summerResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/workspace") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    const summerSave = await summerResponse;
    assert.equal(summerSave.status(), 200);
    const summerState = (await summerSave.json()).state as DataState;
    assert.equal(
      summerState.sessions.find((s) => s.id === utcSession.id)?.startsAt,
      "2030-06-01T18:00:00.000Z",
    );
    const utcRoundTrip = await request("/api/workspace", undefined, admin);
    assert.equal(
      utcRoundTrip.data.state.sessions.find(
        (s: DataState["sessions"][number]) => s.id === utcSession.id,
      ).startsAt,
      "2030-06-01T18:00:00.000Z",
    );
    pass(
      "Admin UTC editor creates and updates winter/summer sessions through real UI, HTTP and PostgreSQL without shifting the clock",
    );
    await navigation.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForURL("**/signin");
    assert.equal(
      (await page.request.get(origin + "/api/auth/me")).status(),
      401,
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  pass(
    "Production mobile sign-in, bottom navigation, Settings sign-out and private founder profiles render without runtime errors",
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
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
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
    assert.equal((await page.goto(origin + "/campaigns"))?.status(), 404);
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
  const bdRoute = "/api/bd-partners";
  assert.equal((await request(bdRoute)).status, 401);
  const registerPartner = {
    action: "register",
    name: "@bd_integration",
    email: "bd-integration@example.invalid",
    bank: "Example Bank",
    accountName: "BD Integration Partner",
    accountNumber: "0123456789",
  };
  assert.equal(
    (await request(bdRoute, registerPartner, admin, false)).status,
    403,
  );
  assert.equal((await request(bdRoute, registerPartner, admin)).status, 200);
  const partner = (await request(bdRoute, undefined, admin)).data[0];
  assert.equal(partner.bankDetails, undefined);
  const bank = (
    await request(bdRoute, { action: "bank", partnerId: partner.id }, admin)
  ).data;
  assert.equal(bank.details.accountNumber, registerPartner.accountNumber);
  const bdDb = new Client({ connectionString: url.toString() });
  await bdDb.connect();
  try {
    const storedBankDetails = (
      await bdDb.query('SELECT "bankDetails" FROM "BdPartner" WHERE id=$1', [
        partner.id,
      ])
    ).rows[0].bankDetails;
    assert.equal(
      JSON.parse(storedBankDetails).accountNumber,
      registerPartner.accountNumber,
    );
    const {
      rows: [candidate],
    } = await bdDb.query(
      `SELECT id, "companyId" FROM "Application" WHERE status='Approved' AND "founderId" IS NOT NULL AND "companyId" IS NOT NULL LIMIT 1`,
    );
    assert.ok(candidate);
    for (let i = 1; i <= 8; i++) {
      const sessionId = `bd-test-space-${i}`;
      const bookingId = `bd-test-booking-${i}`;
      const attendanceId = `bd-test-report-${i}`;
      const saturday = new Date(Date.UTC(2025, 0, 4 + (i - 1) * 7, 19));
      await bdDb.query(
        `INSERT INTO "Session"(id,title,"startsAt",host,capacity,deadline,status,"updatedAt")
         VALUES($1,'BD test Space',$2,'Test',4,$2,'Completed',now())`,
        [sessionId, saturday],
      );
      await bdDb.query(
        `INSERT INTO "BookingRequest"(id,"applicationId","sessionId",speakers,status,"updatedAt")
         VALUES($1,$2,$3,1,'Attended',now())`,
        [bookingId, candidate.id, sessionId],
      );
      const payload = { action: "verify", partnerId: partner.id, bookingId };
      assert.equal((await request(bdRoute, payload, admin)).status, 400);
      await bdDb.query(
        `INSERT INTO "SpaceData"(id,"sessionId","recordedBy","submittedAt","updatedAt")
         VALUES($1,$2,'test',now(),now())`,
        [attendanceId, sessionId],
      );
      await bdDb.query(
        `INSERT INTO "SpaceTeamAttendance"(id,"spaceDataId","companyId","foundersCount")
         VALUES($1,$2,$3,1)`,
        [`bd-test-team-${i}`, attendanceId, candidate.companyId],
      );
      const attempts = await Promise.all([
        request(bdRoute, payload, admin),
        request(bdRoute, payload, admin),
      ]);
      assert.deepEqual(
        attempts.map((attempt) => attempt.status).sort(),
        [200, 409],
      );
      const recorded = (await request(bdRoute, undefined, admin)).data[0];
      assert.equal(recorded.appearances.length, i);
      assert.equal(
        rewardSummary(i, recorded.payments).earned,
        Math.floor(i / 4) * 20_000,
      );
    }
    const pay = {
      action: "pay",
      partnerId: partner.id,
      cycle: 1,
      reference: "BD-TEST-TRANSFER",
      paidOn: "2025-06-01",
    };
    assert.equal(
      (await request(bdRoute, { ...pay, cycle: 3 }, admin)).status,
      400,
    );
    const paymentManager: Jar = { cookie: "", csrf: "" };
    assert.equal(
      (
        await adminManagerRequest({
          action: "invite",
          email: "payment-manager@integration.example.invalid",
          allSpaces: true,
          sessionIds: [],
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await request(
          "/api/manager/verify",
          { token: emailToken() },
          paymentManager,
        )
      ).status,
      200,
    );
    paymentManager.csrf = (
      await request("/api/manager/spaces", undefined, paymentManager)
    ).data.csrf;
    assert.equal(
      (await request(bdRoute, pay, paymentManager, false)).status,
      403,
    );
    const attempts = await Promise.all([
      request(bdRoute, pay, paymentManager),
      request(bdRoute, pay, paymentManager),
    ]);
    assert.deepEqual(
      attempts.map((attempt) => attempt.status).sort(),
      [200, 409],
    );
    assert.equal(
      (await request(bdRoute, { ...pay, cycle: 2 }, admin)).status,
      409,
    );
    const recorded = (await request(bdRoute, undefined, admin)).data[0];
    assert.deepEqual(
      rewardSummary(recorded.appearances.length, recorded.payments),
      {
        verified: 8,
        cycleProgress: 4,
        completedCycles: 2,
        paidCycles: 1,
        unpaidCycles: 1,
        earned: 40_000,
        paid: 20_000,
        outstanding: 20_000,
      },
    );
    assert.equal(recorded.payments[0].paidOn, pay.paidOn);
    assert.equal(recorded.payments[0].reference, pay.reference);
  } finally {
    await bdDb.end();
  }
  const operationsBrowser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await operationsBrowser.newPage({
      viewport: { width: 393, height: 852 },
    });
    const token = admin.cookie.split(";")[0].split("=")[1];
    await page
      .context()
      .addCookies([{ name: "fl_session", value: token, url: origin }]);
    await page.goto(origin + "/dashboard");
    await page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("link", { name: /Admin operations/ })
      .click();
    await page.getByRole("heading", { name: "@bd_integration" }).waitFor();
    const review = page.getByRole("button", {
      name: "Review founder applications",
    });
    await review.click();
    await page
      .getByRole("button", { name: "Review application", exact: true })
      .first()
      .waitFor();
    assert.equal(new URL(page.url()).pathname, "/operations");
    assert.equal(
      await page
        .getByRole("heading", { name: "Register a BD partner" })
        .isVisible(),
      false,
    );
    const bookings = page.getByRole("button", { name: "Manage bookings" });
    await bookings.click();
    const bookingTable = page.getByRole("table", {
      name: "Founder booking requests",
    });
    const status = bookingTable
      .getByRole("combobox", { name: /Booking status/ })
      .first();
    await status.waitFor();
    assert.equal(
      await status.getAttribute("data-status"),
      await status.inputValue(),
    );
    assert.ok(
      await status.evaluate((control) =>
        [
          "rgb(233, 246, 238)",
          "rgb(255, 245, 222)",
          "rgb(252, 236, 236)",
        ].includes(getComputedStyle(control).backgroundColor),
      ),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const pendingStatus = bookingTable
      .locator('select[data-status="Pending"]')
      .first();
    const updateBooking = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/workspace") &&
        response.request().method() === "POST",
    );
    await pendingStatus.selectOption("Declined");
    assert.equal((await updateBooking).status(), 200);
    const declinedStatus = bookingTable
      .locator('select[data-status="Declined"]')
      .first();
    await declinedStatus.waitFor();
    assert.equal(
      await declinedStatus.evaluate(
        (control) => getComputedStyle(control).backgroundColor,
      ),
      "rgb(252, 236, 236)",
    );
    await page.getByRole("button", { name: "BD details" }).click();
    await page
      .getByRole("heading", { name: "Register a BD partner" })
      .waitFor();
    const payOption = await page
      .getByLabel("Reward cycle")
      .locator("option")
      .allTextContents();
    assert.equal(payOption.length, 1);
    assert.match(payOption[0], /Cycle 2.*Pending Payment/);
    await page.getByRole("button", { name: "View transfer details" }).click();
    await page.getByText(/Example Bank.*0123456789/).waitFor();
    await page.getByRole("button", { name: "Hide transfer details" }).click();
    assert.equal(await page.getByText(/0123456789/).count(), 0);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  } finally {
    await operationsBrowser.close();
  }
  pass(
    "BD X username registration, protected bank details, two reward cycles, concurrent duplicate prevention and manager payment recording",
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
