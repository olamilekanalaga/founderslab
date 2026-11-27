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
import { chromium, expect } from "@playwright/test";
import {
  sundaySessions,
  isLondonProgrammeTime,
} from "@/lib/dates/sunday-schedule";
import { rewardSummary } from "@/features/bd-partners/rewards";
import type { DataState } from "@/lib/types";
import {
  PARTICIPATION_TERMS,
  RETIRED_AWARD_COMMANDS,
} from "@/lib/programme-policy";
import { projectLogoPng } from "./fixtures/project-logo";
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
type TelegramPayload = {
  chat_id: string;
  text: string;
  reply_parameters?: {
    message_id: number;
    allow_sending_without_reply: boolean;
  };
};
const telegramChatId = "-1001234567890";
const telegram: { messageId: number; payload: TelegramPayload }[] = [];
const telegramServer = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk.toString();
  const payload = JSON.parse(raw) as TelegramPayload;
  const messageId = telegram.length + 101;
  telegram.push({ messageId, payload });
  const outage = payload.text.includes("Telegram outage founder");
  res.writeHead(outage ? 503 : 200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(
      outage
        ? { ok: false }
        : {
            ok: true,
            result: {
              message_id: messageId,
              chat: { id: Number(telegramChatId) },
            },
          },
    ),
  );
});
await new Promise<void>((resolve) =>
  telegramServer.listen(0, "127.0.0.1", resolve),
);
const telegramAddress = telegramServer.address();
if (!telegramAddress || typeof telegramAddress === "string")
  throw new Error("Mock Telegram unavailable");

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
  TELEGRAM_BOT_TOKEN: "123:integration-fixture",
  TELEGRAM_CHAT_ID: telegramChatId,
  TEST_TELEGRAM_ENDPOINT: `http://127.0.0.1:${telegramAddress.port}`,
  TEST_EMAIL_ENDPOINT: `http://127.0.0.1:${mailAddress.port}`,

  BOOTSTRAP_ADMIN_EMAIL: "admin@integration.example.invalid",
  BOOTSTRAP_ADMIN_NAME: "Integration Admin",
  BOOTSTRAP_ADMIN_PASSWORD: password,
  BD_BANK_ENCRYPTION_KEY: "",
  NODE_ENV: "production" as const,
};
let server: ReturnType<typeof spawn> | undefined;
let output = "";
function run(
  script: string,
  args: string[] = [],
  overrides: Partial<NodeJS.ProcessEnv> = {},
) {
  const r = spawnSync(process.execPath, ["--import", "tsx", script, ...args], {
    env: { ...env, ...overrides },
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
  const historicalBdMigration = "202611230001_bd_rewards";
  const historicalBdSql = readFileSync(
    `prisma/migrations/${historicalBdMigration}/migration.sql`,
    "utf8",
  );
  await legacyDb.query(historicalBdSql);
  await legacyDb.query(
    'INSERT INTO "_founders_migrations"(name, checksum) VALUES($1,$2)',
    [
      historicalBdMigration,
      createHash("sha256").update(historicalBdSql).digest("hex"),
    ],
  );
  await legacyDb.query(
    `INSERT INTO "BdPartner"(id, name, email, "bankDetails") VALUES
    ('legacy-bd', '@Legacy_BD', 'legacy-bd@example.invalid', '{}'),
    ('legacy-name', 'Legacy display name', 'legacy-name@example.invalid', '{}')`,
  );
  const sunday = sundaySessions(new Date(Date.now() + 14 * 86400000), 1)[0]
    .startsAt;
  const saturday = new Date(+sunday - 86400000);
  const saturdayDay = saturday.toISOString().slice(0, 10);
  const oldDeadline = new Date(+saturday - 3 * 3600000);
  await legacyDb.query(
    `INSERT INTO "Session"(id,title,"startsAt",host,deadline,status,"updatedAt")
     VALUES ('legacy-week','Programme Space',$1,'Host',$2,'Scheduled',now()),
            ('legacy-custom','Custom Space',$1,'Host',$2,'Scheduled',now()),
            ('legacy-completed','Completed Space',$1,'Host',$2,'Completed',now())`,
    [saturday, oldDeadline],
  );
  await legacyDb.query(
    `INSERT INTO "ProgrammeSchedule"(id,"anchorDay") VALUES ('main',$1)`,
    [saturdayDay],
  );
  await legacyDb.query(
    `INSERT INTO "ProgrammeWeek"("sessionId",position) VALUES ('legacy-week',0), ('legacy-completed',1)`,
  );
  await legacyDb.query(
    `INSERT INTO "BookingRequest"(id,"applicationId","sessionId",speakers,status,"updatedAt")
     VALUES ('legacy-booking','legacy-a','legacy-week',2,'Approved',now())`,
  );
  run("scripts/migrate.ts");
  run("scripts/migrate.ts");
  const changedSchedule = (
    await legacyDb.query(
      'SELECT "anchorDay" FROM "ProgrammeSchedule" WHERE id=$1',
      ["main"],
    )
  ).rows[0];
  assert.equal(changedSchedule.anchorDay, sunday.toISOString().slice(0, 10));
  const shifted = (
    await legacyDb.query(
      'SELECT "startsAt",deadline,timezone FROM "Session" WHERE id=$1',
      ["legacy-week"],
    )
  ).rows[0];
  assert.equal(+shifted.startsAt, +sunday);
  assert.equal(+shifted.deadline, +sunday - 3 * 3600000);
  assert.equal(shifted.timezone, "Europe/London");
  const untouched = (
    await legacyDb.query(
      'SELECT id, "startsAt" FROM "Session" WHERE id IN ($1,$2)',
      ["legacy-custom", "legacy-completed"],
    )
  ).rows;
  assert.equal(untouched.length, 2);
  assert.ok(untouched.every((row) => +row.startsAt === +saturday));
  assert.equal(
    (
      await legacyDb.query(
        'SELECT "sessionId" FROM "BookingRequest" WHERE id=$1',
        ["legacy-booking"],
      )
    ).rows[0].sessionId,
    "legacy-week",
  );
  await legacyDb.query('DELETE FROM "BookingRequest"');
  await legacyDb.query('DELETE FROM "ProgrammeWeek"');
  await legacyDb.query('DELETE FROM "ProgrammeSchedule"');
  await legacyDb.query('DELETE FROM "Session"');
  const legacyPartners = (
    await legacyDb.query(
      'SELECT "referralCode", active FROM "BdPartner" ORDER BY id',
    )
  ).rows;
  assert.deepEqual(legacyPartners, [
    { referralCode: "legacy_bd", active: true },
    { referralCode: "bd_legacyname", active: true },
  ]);
  await legacyDb.query('DELETE FROM "BdPartner"');
  for (const table of ["Founder", "Company", "Application"]) {
    const row = (await legacyDb.query(`SELECT * FROM "${table}"`)).rows[0];
    if (table === "Company") {
      assert.equal(row.xHandle, null);
      delete row.xHandle;
    }
    if (table === "Application") {
      for (const field of [
        "projectXHandle",
        "bdReferrerXHandle",
        "bdReviewStatus",
        "bdPartnerId",
      ]) {
        assert.equal(row[field], null);
        delete row[field];
      }
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
  run("scripts/prepare-vercel.ts", [], {
    BOOTSTRAP_ADMIN_EMAIL: "invalid legacy email",
    BOOTSTRAP_ADMIN_PASSWORD: "short",
  });
  const initialDb = new Client({ connectionString: url.toString() });
  await initialDb.connect();
  assert.equal(
    (await initialDb.query('SELECT count(*)::int AS n FROM "Founder"')).rows[0]
      .n,
    0,
  );
  assert.equal(
    (await initialDb.query('SELECT count(*)::int AS n FROM "User"')).rows[0].n,
    0,
  );
  run("scripts/admin.ts");
  const slots = await initialDb.query(
    'SELECT id,"startsAt",capacity FROM "Session" ORDER BY "startsAt"',
  );
  assert.equal(slots.rows.length, 8);
  assert.ok(
    slots.rows.every(
      (row) =>
        new Date(row.startsAt).getUTCDay() === 0 &&
        isLondonProgrammeTime(row.startsAt) &&
        row.capacity === 4,
    ),
  );
  await initialDb.query('UPDATE "Session" SET status=$1 WHERE id=$2', [
    "Cancelled",
    slots.rows.at(-1)!.id,
  ]);
  run("scripts/prepare-vercel.ts");
  assert.equal(
    (
      await initialDb.query('SELECT status FROM "Session" WHERE id=$1', [
        slots.rows.at(-1)!.id,
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
    "Production release initializes defaults without requiring legacy credentials or creating accounts",
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
  run("scripts/publish-sundays.ts");
  run("scripts/publish-sundays.ts");
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
        ["2026-12-06T19:00:00Z"],
      )
    ).rows[0].n,
    1,
  );
  await scheduleDb.end();
  run("scripts/admin.ts");
  server = spawn(
    process.execPath,
    [
      "--import",
      "./tests/fixtures/mock-telegram.mjs",
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
  for (const route of ["/register", "/invite"]) {
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
  const result = await request("/api/public/apply", {
    ...application,
    projectLogo: "data:image/png;base64," + projectLogoPng,
  });
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
  const logoPath = "/api/project-logo/" + app.id;
  assert.equal(linked.hasProjectLogo, true);
  assert.equal(state.companyLogoApplicationIds?.[linked.companyId!], app.id);
  assert.equal((await fetch(origin + logoPath)).status, 401);
  const logo = await fetch(origin + logoPath, {
    headers: { Cookie: admin.cookie },
  });
  assert.equal(logo.status, 200);
  assert.equal(logo.headers.get("content-type"), "image/png");
  assert.deepEqual(
    Buffer.from(await logo.arrayBuffer()),
    Buffer.from(projectLogoPng, "base64"),
  );

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
    startsAt: "2026-12-27T19:00:00.000Z",
    timezone: "Africa/Lagos",
    host: "Fictional host",
    capacity: 5,
    deadline: "2026-12-27T19:00:00.000Z",
    status: "Scheduled",
    researchStatus: "Not started",
    liveUrl: "",
    recordingUrl: "",
    notes: "Integration fixture",
  };
  state = await command("session.save", sessionPayload);
  const session = state.sessions.find((s) => s.title === sessionPayload.title)!;
  const bookingWindowDb = new Client({ connectionString: url.toString() });
  await bookingWindowDb.connect();
  await bookingWindowDb.query(
    'UPDATE "ProgrammeSchedule" SET "activeStart"=(SELECT position FROM "ProgrammeWeek" WHERE "sessionId"=$1) WHERE id=$2',
    [session.id, "main"],
  );
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
  const lockedBooking = publicSessions.data.sessions[1];
  assert.equal(publicSessions.data.sessions.length, 3);
  assert.equal(publicSession.bookingLocked, false);
  assert.ok(
    publicSessions.data.sessions
      .slice(1)
      .every((row: { bookingLocked: boolean }) => row.bookingLocked),
  );
  assert.equal(
    (
      await request("/api/public/book", {
        token: capability,
        sessionId: lockedBooking.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/public/apply", {
        ...application,
        founderName: "Locked Founder",
        companyName: "Locked Product",
        xHandle: "locked_product",
        sessionId: lockedBooking.id,
      })
    ).status,
    409,
  );
  await bookingWindowDb.query(
    'UPDATE "ProgrammeSchedule" SET "activeStart"=$1 WHERE id=$2',
    [lockedBooking.position, "main"],
  );
  await bookingWindowDb.end();
  const calendarApplication = {
    ...application,
    founderName: "Calendar Founder",
    companyName: "Calendar Product",
    xHandle: "calendar_product",
    sessionId: lockedBooking.id,
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
  const calendarState = (await request("/api/workspace", undefined, admin)).data
    .state as DataState;
  const calendarRecord = calendarState.applications.find(
    (entry) => entry.reference === calendarResult.data.reference,
  )!;
  const availableSeats = async () =>
    (await request("/api/public/sessions")).data.sessions.find(
      (entry: { id: string }) => entry.id === lockedBooking.id,
    ).availableSeats as number;
  const seatsBeforeApproval = await availableSeats();
  await new Promise((resolve) => setTimeout(resolve, 1100));
  for (let attempt = 0; attempt < 2; attempt++)
    await command("application.review", {
      id: calendarRecord.id,
      status: "Approved",
    });
  assert.equal(await availableSeats(), seatsBeforeApproval - 1);
  const cancelled = await command("application.review", {
    id: calendarRecord.id,
    status: "Declined",
  });
  assert.equal(
    cancelled.bookings.find(
      (entry) => entry.applicationId === calendarRecord.id,
    )?.status,
    "Cancelled",
  );
  assert.equal(await availableSeats(), seatsBeforeApproval);
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
  const telegramDb = new Client({ connectionString: url.toString() });
  await telegramDb.connect();
  const notificationFor = async (id: string) =>
    (
      await telegramDb.query(
        'SELECT n.*, b."createdAt" FROM "BookingTelegramNotification" n JOIN "BookingRequest" b ON b.id=n."bookingId" WHERE b."applicationId"=$1',
        [id],
      )
    ).rows[0];
  const textFor = (messageId: number) =>
    telegram.find((entry) => entry.messageId === messageId)!.payload;
  try {
    await expect
      .poll(async () => (await notificationFor(app.id))?.initialState)
      .toBe("sent");
    await expect
      .poll(
        async () => (await notificationFor(calendarRecord.id))?.approvalState,
      )
      .toBe("sent");
    const original = await notificationFor(app.id);
    const calendar = await notificationFor(calendarRecord.id);
    assert.notEqual(original.originalMessageId, calendar.originalMessageId);
    const alert = textFor(Number(original.originalMessageId));
    assert.equal(alert.chat_id, telegramChatId);
    assert.match(alert.text, /^FOUNDERSLAB — NEW BOOKING/);
    assert.ok(alert.text.includes("Founder: " + linked.founderName));
    assert.match(alert.text, /Founder X: https:\/\/x\.com\/isolated_example/);
    assert.match(alert.text, /Project X: https:\/\/x\.com\/isolated_project/);
    assert.match(
      alert.text,
      /Project website: https:\/\/isolated\.example\.invalid\//,
    );
    assert.match(alert.text, /Speakers: 3/);
    assert.match(
      alert.text,
      /Requested session: Sunday, 27 December 2026 at 19:00:00 UK time/,
    );
    assert.match(alert.text, /Status: Pending approval/);
    assert.match(alert.text, /Submitted: .+ UK time/);
    assert.doesNotMatch(alert.text, /Contact:|Comments:|BD referrer/);
    const approval = textFor(Number(calendar.approvalMessageId));
    assert.deepEqual(approval.reply_parameters, {
      message_id: Number(calendar.originalMessageId),
      allow_sending_without_reply: false,
    });
    assert.match(approval.text, /Approved by: Integration Admin/);
    assert.match(approval.text, /Role: Admin/);
    assert.match(approval.text, /Approved at: .+ UK time/);
    const seconds = Math.floor(
      (+calendar.approvedAt - +calendar.createdAt) / 1000,
    );
    const duration = approval.text.match(
      /Time to approval: (?:(\d+)h )?(?:(\d+)m )?(\d+)s/,
    );
    assert.ok(duration);
    assert.ok(seconds >= 1);
    assert.equal(
      Number(duration[1] ?? 0) * 3600 +
        Number(duration[2] ?? 0) * 60 +
        Number(duration[3]),
      seconds,
    );
    assert.equal(
      telegram.filter(
        ({ payload }) =>
          payload.reply_parameters?.message_id ===
          Number(calendar.originalMessageId),
      ).length,
      1,
    );
  } finally {
    await telegramDb.end();
  }
  pass(
    "Public booking alerts contain only booking data and a confirmed booking gets one threaded approval reply",
  );
  const messagesBeforeSpaceData = telegram.length;
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
  assert.equal(telegram.length, messagesBeforeSpaceData);

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
  for (const action of ["accept-invite", "register", "bootstrap"]) {
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
    "Legacy owner authentication remains scoped and inactive sessions lose access",
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
    await lineup.getByRole("button", { name: "Next Sunday" }).click();
    assert.match(await lineup.innerText(), /3 January 2027/);
    assert.equal(await managerPage.getByText("Manage invitations").count(), 0);
    await managerPage
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("link", { name: /Admin operations/ })
      .click();
    await managerPage.goto(
      `${origin}/operations?tab=applications&review=${application.id}`,
    );
    const applicationDialog = managerPage.getByRole("dialog", {
      name: /^Application/,
    });
    await expect(
      applicationDialog.getByText("Booking confirmed", { exact: true }),
    ).toBeVisible();
    await expect(
      applicationDialog.getByText(/A project seat is reserved for .*27 Dec/),
    ).toBeVisible();
    await managerPage.getByRole("button", { name: "Close dialog" }).click();
    await managerPage.getByRole("button", { name: "BD details" }).click();
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
  assert.equal(report.founders.length, 52);
  assert.equal(
    report.countries.reduce((sum, c) => sum + c.value, 0),
    52,
  );
  assert.equal(
    reportData(state, { ...blankFilters, country: "Nigeria" }).founders.length,
    22,
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
    await expect(page.locator(".desk-heading")).toHaveAttribute(
      "data-motion-visible",
      "",
    );
    await page.screenshot({
      path: artifactPath("admin-desk-populated-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1358, height: 644 });
    await page.mouse.move(0, 0);
    // Measure the rendered chart after fonts and the resized viewport settle.
    await page.locator(".desk-activity .studio-chart").waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });
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
    const [nextSunday] = sundaySessions(new Date(), 1);
    const cardState = structuredClone(state);
    const mobileSpace = {
      ...cardState.sessions[0],
      id: nextSunday.id,
      startsAt: nextSunday.startsAt.toISOString(),
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
    const sundayCard = page.getByRole("region", {
      name: "Sunday Founder Space",
    });
    await sundayCard
      .getByText("No projects booked yet.", { exact: false })
      .waitFor();
    assert.equal(
      await sundayCard.locator(".current-sunday-slots span").count(),
      12,
    );
    assert.equal(
      await sundayCard
        .getByRole("link", { name: "View Bookings" })
        .getAttribute("href"),
      "/spaces?tab=bookings&session=" + mobileSpace.id,
    );
    assert.equal(
      await sundayCard.evaluate(
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
    await page.goto(origin + "/companies?q=Isolated%20Example");
    const companyCard = page.locator("article.founder-tile").filter({
      has: page.getByRole("link", { name: "Isolated Example", exact: true }),
    });
    const companyCardLogo = companyCard.locator(".person-avatar-logo");
    await expect(companyCardLogo).toHaveAttribute("src", logoPath);
    await expect(companyCard).toHaveAttribute("data-motion-visible", "");
    await expect
      .poll(() =>
        companyCardLogo.evaluate(
          (image: HTMLImageElement) => image.naturalWidth,
        ),
      )
      .toBeGreaterThan(0);
    await companyCard
      .getByRole("link", { name: "Isolated Example", exact: true })
      .click();
    await expect(
      page.locator(".profile-banner .person-avatar-logo"),
    ).toHaveAttribute("src", logoPath);
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
    const directory = navigation.getByRole("link", { name: "Directory" });
    await directory.click();
    await expect(directory).toHaveAttribute("aria-current", "page");
    await expect(directory.locator("svg")).toHaveCSS(
      "animation-name",
      "fl-control-settle",
    );
    const founderCard = page.locator(".founder-tile").first();
    await founderCard.scrollIntoViewIfNeeded();
    await expect(founderCard).toHaveAttribute("data-motion-visible", "");
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
    await expect(page.locator(".fl-page-progress")).toBeHidden();
    await expect(account).toHaveCSS("animation-name", "none");
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
    const themePicker = account.getByLabel("Workspace theme");
    const workspace = page.locator(".app-shell");
    async function textContrast(selector: string) {
      return page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const context = document.createElement("canvas").getContext("2d")!;
          const colors = [getComputedStyle(element).color];
          for (
            let node: Element | null = element;
            node;
            node = node.parentElement
          )
            colors.push(getComputedStyle(node).backgroundColor);
          const [foreground, ...backgrounds] = colors.map((color) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
            const [red, green, blue] = [r, g, b].map((channel) => {
              const value = channel / 255;
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            });
            return {
              value: 0.2126 * red + 0.7152 * green + 0.0722 * blue,
              alpha,
            };
          });
          const background = backgrounds.find(({ alpha }) => alpha === 255);
          if (background)
            return (
              (Math.max(foreground.value, background.value) + 0.05) /
              (Math.min(foreground.value, background.value) + 0.05)
            );
          return 0;
        });
    }
    async function checkHeaderAppearance(theme: string) {
      for (const mode of ["Glass", "Reduced effects", "System"]) {
        await account.getByRole("button", { name: mode, exact: true }).click();
        await expect(workspace.locator(".topbar")).toHaveCSS(
          "background-color",
          "rgba(0, 0, 0, 0)",
        );
        assert.ok(
          (await textContrast(".topbar-left > b")) >= 4.5,
          `${theme} header in ${mode}`,
        );
      }
    }
    await checkHeaderAppearance("founders");
    for (const [name, color] of [
      ["superteam", "rgb(17, 23, 38)"],
      ["classic", "rgb(255, 255, 255)"],
      ["neutral", "rgb(247, 247, 244)"],
      ["scientific", "rgb(247, 250, 255)"],
      ["sticker", "rgb(255, 248, 252)"],
      ["pixel", "rgb(18, 19, 21)"],
    ]) {
      await themePicker.selectOption(name);
      await expect(workspace).toHaveCSS("background-color", color);
      await checkHeaderAppearance(name);
      await expect(account).toHaveCSS("backdrop-filter", "none");
      await account.getByRole("button", { name: "Close dialog" }).click();
      await page.getByRole("button", { name: "Activity", exact: true }).click();
      await activity.getByRole("rowheader").first().waitFor();
      await expect(activity.getByRole("rowheader").first()).toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)",
      );
      assert.ok(
        (await textContrast(".studio-audit-table tbody th")) >= 4.5,
        name + " audit text",
      );
      await page.goto(origin + "/founders?q=no-matching-founder-fixture");
      await expect(workspace).toHaveAttribute("data-workspace-theme", name);
      await expect(page.locator(".search-input input")).toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)",
      );
      for (const selector of [
        ".empty h3",
        ".empty p",
        ".segmented button[aria-pressed=true]",
        ".page-heading .button.primary",
      ]) {
        assert.ok((await textContrast(selector)) >= 4.5, name + " " + selector);
      }
      await page.goto(origin + "/reports");
      await expect(workspace).toHaveAttribute("data-workspace-theme", name);
      const reportCards = ".metric-grid > .metric-card";
      await expect(page.locator(reportCards)).toHaveCount(3);
      for (let index = 1; index <= 3; index++) {
        for (const part of ["div", "strong"]) {
          assert.ok(
            (await textContrast(
              `${reportCards}:nth-child(${index}) > ${part}`,
            )) >= 4.5,
            `${name} report card ${index} ${part}`,
          );
        }
      }
      await page.goto(origin + "/settings");
      await page.getByRole("button", { name: /Open account menu/ }).click();
    }
    await themePicker.selectOption("superteam");
    await page.reload();
    await expect(workspace).toHaveAttribute(
      "data-workspace-theme",
      "superteam",
    );
    await expect(workspace).toHaveAttribute("data-visual-effects", "system");
    await page.goto(origin + "/dashboard");
    await expect(workspace).toHaveAttribute(
      "data-workspace-theme",
      "superteam",
    );
    await page.locator(".desk-activity .studio-chart").waitFor();
    await page.screenshot({ path: artifactPath("superteam-theme-mobile.png") });
    await page.getByRole("button", { name: /Open account menu/ }).click();
    await themePicker.selectOption("founders");
    await expect(workspace).toHaveAttribute("data-workspace-theme", "founders");
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
    const date = new Date("2026-10-04T19:00:00Z");
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
    ["2026-10-04", "main"],
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
  await cycleDb.query('UPDATE "Session" SET status=$1 WHERE id=$2', [
    "Completed",
    cycleIds[0],
  ]);
  const beforeSubmission = await request("/api/public/sessions");
  assert.equal(beforeSubmission.data.sessions[0].id, cycleIds[0]);
  assert.deepEqual(
    beforeSubmission.data.sessions.map(
      ({ bookingLocked }: { bookingLocked: boolean }) => bookingLocked,
    ),
    [false, true, true],
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
    1,
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
    3,
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
  assert.equal(publicWindow.data.sessions.length, 3);
  assert.ok(
    publicWindow.data.sessions.every(
      (s: { position: number }) => s.position >= 4 && s.position < 7,
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
    "Public Sundays advance after submitted Space data, while a Completed status alone, drafts and repeated submissions do not unlock dates",
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
  const registration = await request(
    bdRoute,
    { ...registerPartner, fullName: "Integration BD Partner" },
    admin,
  );
  assert.equal(registration.status, 200);
  assert.equal(registration.data.referralCode, "bd_integration");
  const partner = (await request(bdRoute, undefined, admin)).data[0];
  assert.equal(partner.fullName, "Integration BD Partner");
  assert.equal(partner.bankDetails, undefined);
  const bank = (
    await request(bdRoute, { action: "bank", partnerId: partner.id }, admin)
  ).data;
  assert.equal(bank.details.accountNumber, registerPartner.accountNumber);
  const bdDb = new Client({ connectionString: url.toString() });
  await bdDb.connect();
  const paymentManager: Jar = { cookie: "", csrf: "" };
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
    const otherPartner = (await request(bdRoute, undefined, admin)).data.find(
      (row: { id: string }) => row.id !== partner.id,
    );
    assert.ok(otherPartner);
    const duplicateHandle = await request(
      bdRoute,
      {
        ...registerPartner,
        name: "BD_INTEGRATION",
        email: "another-bd@example.invalid",
      },
      admin,
    );
    assert.equal(duplicateHandle.status, 409);
    assert.equal(
      (
        await request(
          bdRoute,
          {
            ...registerPartner,
            name: "bdxintegration",
            email: "lookalike-bd@example.invalid",
          },
          admin,
        )
      ).status,
      200,
    );

    const linkedJar: Jar = { cookie: "", csrf: "" };
    await request("/book?ref=BD_INTEGRATION", undefined, linkedJar);
    const referred = await request(
      "/api/public/apply",
      {
        ...application,
        founderName: "Referred founder",
        companyName: "Referred project",
        xHandle: "referred_founder",
        projectXHandle: "referred_proj",
        bdReferrerXHandle: "@BD_INTEGRATION",
      },
      linkedJar,
    );
    assert.equal(referred.status, 201, JSON.stringify(referred.data));
    assert.equal(referred.data.bdPartnerId, undefined);
    const unmatched = await request("/api/public/apply", {
      ...application,
      founderName: "Unmatched founder",
      companyName: "Unmatched project",
      xHandle: "unmatched_user",
      projectXHandle: "unmatched_proj",
      bdReferrerXHandle: "bd_integration",
    });
    assert.equal(unmatched.status, 201, JSON.stringify(unmatched.data));
    const intake = (await request("/api/workspace", undefined, admin)).data
      .state as DataState;
    const linkedReferral = intake.applications.find(
      (row) => row.reference === referred.data.reference,
    )!;
    const unresolved = intake.applications.find(
      (row) => row.reference === unmatched.data.reference,
    )!;
    assert.equal(linkedReferral.bdPartnerId, partner.id);
    assert.equal(linkedReferral.bdReferrerXHandle, "bd_integration");
    assert.equal(unresolved.bdPartnerId, null);
    assert.equal(unresolved.bdReferrerXHandle, null);
    const attribute = {
      action: "attribute",
      applicationId: unresolved.id,
      partnerId: otherPartner.id,
    };
    assert.equal((await request(bdRoute, attribute, admin, false)).status, 403);
    assert.equal((await request(bdRoute, attribute, admin)).status, 409);
    assert.equal(
      (
        await request(
          bdRoute,
          { ...attribute, applicationId: linkedReferral.id },
          admin,
        )
      ).status,
      409,
    );

    const approvedState = await command("application.review", {
      id: linkedReferral.id,
      status: "Approved",
    });
    const candidate = approvedState.applications.find(
      (row) => row.id === linkedReferral.id,
    )!;
    assert.equal(candidate.bdPartnerId, partner.id);
    assert.ok(candidate.companyId);
    for (let i = 1; i <= 8; i++) {
      const sessionId = `bd-test-space-${i}`;
      const bookingId = `bd-test-booking-${i}`;
      const attendanceId = `bd-test-report-${i}`;
      const sunday = new Date(Date.UTC(2025, 0, 5 + (i - 1) * 7, 19));
      await bdDb.query(
        `INSERT INTO "Session"(id,title,"startsAt",host,capacity,deadline,status,"updatedAt")
         VALUES($1,'BD test Space',$2,'Test',4,$2,$3,now())`,
        [sessionId, sunday, i === 1 ? "Scheduled" : "Completed"],
      );
      await bdDb.query(
        `INSERT INTO "BookingRequest"(id,"applicationId","sessionId",speakers,status,"updatedAt")
         VALUES($1,$2,$3,1,$4,now())`,
        [bookingId, candidate.id, sessionId, i === 1 ? "Attended" : "Approved"],
      );
      const payload = { action: "finalize", sessionId, confirmed: true };
      assert.equal((await request(bdRoute, payload, admin)).status, 409);
      await bdDb.query(
        `INSERT INTO "SpaceData"(id,"sessionId","recordedBy","submittedAt","updatedAt")
         VALUES($1,$2,'test',now(),now())`,
        [attendanceId, sessionId],
      );
      if (i === 1) {
        assert.equal((await request(bdRoute, payload, admin)).status, 409);
        await bdDb.query('UPDATE "Session" SET status=$2 WHERE id=$1', [
          sessionId,
          "Completed",
        ]);
        const withoutRoster = await request(bdRoute, payload, admin);
        assert.equal(withoutRoster.status, 200);
        assert.equal(withoutRoster.data.credited, 0);
      }
      await bdDb.query(
        'UPDATE "SpaceData" SET "founderBookingIds"=$2 WHERE "sessionId"=$1',
        [sessionId, [bookingId]],
      );
      const beforeFinal = (await request(bdRoute, undefined, admin)).data[0];
      assert.equal(beforeFinal.appearances.length, i - 1);
      const attempts = await Promise.all([
        request(bdRoute, payload, admin),
        request(bdRoute, payload, admin),
      ]);
      assert.deepEqual(
        attempts.map((attempt) => attempt.status),
        [200, 200],
      );
      assert.deepEqual(
        attempts.map((attempt) => attempt.data.credited).sort(),
        [0, 1],
      );
      const recorded = (await request(bdRoute, undefined, admin)).data[0];
      assert.equal(recorded.appearances.length, i);
      const reward = rewardSummary(i, recorded.payments);
      assert.equal(reward.earned, Math.floor(i / 4) * 20_000);
      assert.equal(reward.unpaidCycles, Math.floor(i / 4));
      assert.equal(reward.cycleProgress, i % 4 || 4);
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
    const managerInvite = await adminManagerRequest({
      action: "manual",
      email: "payment-manager@integration.example.invalid",
    });
    assert.equal(managerInvite.status, 201);
    const managerToken = new URLSearchParams(
      new URL(managerInvite.data.link).hash.slice(1),
    ).get("token");
    assert.equal(
      (
        await request(
          "/api/manager/verify",
          { token: managerToken },
          paymentManager,
        )
      ).status,
      200,
    );
    paymentManager.csrf = (
      await request("/api/manager/spaces", undefined, paymentManager)
    ).data.csrf;
    assert.equal(
      (
        await request(
          bdRoute,
          {
            action: "finalize",
            sessionId: "bd-test-space-8",
            confirmed: true,
          },
          paymentManager,
        )
      ).status,
      403,
    );
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
    const operationsTabs = page.getByRole("navigation", {
      name: "Admin operations sections",
    });
    await expect(operationsTabs.getByRole("button")).toHaveText([
      "Applications",
      "Bookings",
      "Spaces",
      "BD details",
      "BD Performance",
    ]);
    await expect(
      operationsTabs.getByRole("button", { name: "Applications" }),
    ).toHaveAttribute("aria-pressed", "true");
    await operationsTabs.getByRole("button", { name: "BD details" }).click();
    await page.getByRole("heading", { name: "@bd_integration" }).waitFor();
    const referralTable = page
      .getByRole("region", { name: "Founder referrals for @bd_integration" })
      .getByRole("table", { name: "Referred founders" });
    await referralTable
      .getByRole("rowheader", { name: "Referred founder" })
      .waitFor();
    await referralTable
      .getByText("Verified — counts towards payment", { exact: true })
      .waitFor();
    const review = page.getByRole("button", {
      name: "Applications",
    });
    await review.click();
    const applications = page.getByRole("table", {
      name: "Founder applications",
    });
    await expect(applications.getByRole("columnheader")).toHaveText([
      "Project / Founder",
      "Country",
      "Status",
      "Review",
    ]);
    const statusFilter = page.getByLabel("Space workflow status");
    await statusFilter.selectOption("Approved");
    const approvedRow = applications
      .getByRole("row")
      .filter({ hasText: "Approved" })
      .first();
    await expect(approvedRow).toBeVisible();
    await approvedRow
      .getByRole("button", { name: "Review application", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: /^Application/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    assert.equal(new URL(page.url()).pathname, "/operations");
    assert.equal(
      await page
        .getByRole("heading", { name: "Register a BD partner" })
        .isVisible(),
      false,
    );
    const bookings = page.getByRole("button", { name: "Bookings" });
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
    await expect(bookingTable.getByRole("columnheader")).toHaveText([
      "Space",
      "Project / Founder",
      "People expected",
      "Status",
    ]);
    const pendingStatus = bookingTable
      .locator('select[data-status="Pending"]')
      .first();
    const changedRow = await pendingStatus.evaluate(
      (control) => control.closest("tr")!.sectionRowIndex,
    );
    const updateBooking = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/workspace") &&
        response.request().method() === "POST",
    );
    await pendingStatus.selectOption("Cancelled");
    assert.equal((await updateBooking).status(), 200);
    const cancelledStatus = bookingTable
      .locator("tbody select")
      .nth(changedRow);
    await expect(cancelledStatus).toHaveValue("Cancelled");
    await expect(cancelledStatus).toHaveCSS(
      "background-color",
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
    await expect(
      page
        .getByRole("navigation", { name: "Workspace navigation" })
        .getByRole("link", { name: "BD Performance", exact: true }),
    ).toHaveCount(0);

    const managerPage = await operationsBrowser.newPage({
      viewport: { width: 393, height: 852 },
    });
    await managerPage.context().addCookies([
      {
        name: "fl_space_manager",
        value: paymentManager.cookie.split("=")[1],
        url: origin,
      },
    ]);
    await managerPage.goto(origin + "/operations?tab=bd");
    const partnerPanel = managerPage.locator("section").filter({
      has: managerPage.getByRole("heading", {
        name: "@bd_integration",
        exact: true,
      }),
    });
    await partnerPanel
      .getByText("Edit partner and private access", { exact: true })
      .click();
    await partnerPanel
      .getByLabel("Full name", { exact: true })
      .fill("Updated BD profile");
    await partnerPanel.getByRole("button", { name: "Save partner" }).click();
    await expect(
      partnerPanel.getByText(
        "Updated BD profile · bd-integration@example.invalid",
      ),
    ).toBeVisible();
    await partnerPanel
      .getByRole("button", { name: "Generate private dashboard invitation" })
      .click();
    await expect(
      managerPage.getByRole("dialog", { name: "Partner dashboard invitation" }),
    ).toBeVisible();

    await page.goto(origin + "/bd-performance");
    await expect(page).toHaveURL(/\/operations\?tab=performance$/);
    await managerPage.goto(origin + "/operations");
    const performanceButton = managerPage.getByRole("button", {
      name: "BD Performance",
      exact: true,
    });
    await performanceButton.click();
    await expect(managerPage).toHaveURL(/\/operations\?tab=performance$/);
    await expect(performanceButton).toHaveAttribute("aria-pressed", "true");
    await expect(
      managerPage.getByRole("heading", { name: "BD Performance", exact: true }),
    ).toBeVisible();
    const metrics = managerPage.locator(".bd-performance-metrics");
    for (const [label, value] of [
      ["Verified appearances", "8"],
      ["Commission earned", "₦40,000"],
      ["Commission paid", "₦20,000"],
    ]) {
      await expect(
        metrics
          .getByText(label, { exact: true })
          .locator("..")
          .locator("strong"),
      ).toHaveText(value);
    }
    assert.equal(await metrics.locator(".metric-card").count(), 10);
    await expect(
      managerPage.getByRole("region", { name: "BD performance leaderboard" }),
    ).toBeVisible();
    assert.ok(
      await managerPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  } finally {
    await operationsBrowser.close();
  }
  pass(
    "BD X username registration, protected bank details, two reward cycles, concurrent duplicate prevention and manager payment recording",
  );
  const profileBrowser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await profileBrowser.newPage({
      viewport: { width: 393, height: 852 },
    });
    await page.goto(origin + "/apply");
    await expect(page.getByLabel("BD referrer’s X username")).toHaveCount(0);
    await page.goto(origin + "/book?ref=BD_Integration");
    assert.match(page.url(), /#choose-a-sunday$/);
    await page.goto(origin + "/apply");
    const referredHtml = await (
      await page.request.get(origin + "/apply")
    ).text();
    assert.match(
      referredHtml,
      /readonly=""[^>]*value="@bd_integration"|value="@bd_integration"[^>]*readonly=""/i,
    );
    const lockedHandle = page.getByLabel("BD referrer’s X username");
    await expect(lockedHandle).toHaveValue("@bd_integration");
    await expect(lockedHandle).toHaveAttribute("readonly", "");
  } finally {
    await profileBrowser.close();
  }

  async function openReferral(code: string, jar: Jar) {
    const response = await request(
      `/book?ref=${encodeURIComponent(code)}`,
      undefined,
      jar,
    );
    assert.equal(response.status, 307);
    assert.match(jar.cookie, /^fl_bd_referral=/);
    return request("/api/public/referral", undefined, jar);
  }
  const referralJar: Jar = { cookie: "", csrf: "" };
  assert.deepEqual((await openReferral("bd_integration", referralJar)).data, {
    handle: "@bd_integration",
    locked: true,
    valid: true,
  });
  const lockedApplication = {
    ...application,
    founderName: "Linked founder",
    companyName: "Linked project",
    xHandle: "linked_founder",
    projectXHandle: "linked_project",
    bdReferrerXHandle: "zz_manager_bd",
  };
  const linkedResult = await request(
    "/api/public/apply",
    lockedApplication,
    referralJar,
  );
  assert.equal(linkedResult.status, 201);
  const afterReferral = (await request("/api/workspace", undefined, admin)).data
    .state as DataState;
  const tracked = afterReferral.applications.find(
    (row) => row.reference === linkedResult.data.reference,
  )!;
  assert.equal(tracked.bdPartnerId, partner.id);
  assert.equal(tracked.bdReferrerXHandle, "bd_integration");
  const unknownJar: Jar = { cookie: "", csrf: "" };
  assert.equal(
    (await openReferral("unknown_referrer", unknownJar)).data.valid,
    false,
  );
  const unknownResult = await request(
    "/api/public/apply",
    {
      ...lockedApplication,
      xHandle: "unknown_founder",
      companyName: "Unknown referral",
      projectXHandle: "unknown_project",
    },
    unknownJar,
  );
  assert.equal(unknownResult.status, 201);
  const afterUnknown = (await request("/api/workspace", undefined, admin)).data
    .state as DataState;
  assert.equal(
    afterUnknown.applications.find(
      (row) => row.reference === unknownResult.data.reference,
    )?.bdPartnerId,
    null,
  );

  const partnerJar: Jar = { cookie: "", csrf: "" };
  assert.equal((await request("/api/bd-access")).status, 401);
  const partnerAccess = await request(
    bdRoute,
    { action: "access", partnerId: partner.id },
    admin,
  );
  assert.equal(partnerAccess.status, 200);
  const partnerToken = new URLSearchParams(
    new URL(partnerAccess.data.accessLink).hash.slice(1),
  ).get("token");
  assert.equal(
    (
      await request(
        "/api/bd-access",
        { action: "verify", token: partnerToken },
        partnerJar,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/bd-access", { action: "verify", token: partnerToken }))
      .status,
    401,
  );
  const partnersAfter = (await request(bdRoute, undefined, admin)).data;
  const anotherPartner = partnersAfter.find(
    (row: { id: string }) => row.id !== partner.id,
  );
  const privateData = await request(
    `/api/bd-access?partnerId=${anotherPartner.id}`,
    undefined,
    partnerJar,
  );
  assert.equal(privateData.status, 200);
  assert.equal(privateData.data.referralCode, "bd_integration");
  assert.ok(
    privateData.data.applications.some(
      (row: { id: string }) => row.id === tracked.id,
    ),
  );
  assert.ok(
    privateData.data.applications.every(
      (row: { id: string }) =>
        afterReferral.applications.find((app) => app.id === row.id)
          ?.bdPartnerId === partner.id,
    ),
  );
  assert.equal(privateData.data.bankDetails, undefined);
  assert.equal(privateData.data.email, undefined);
  assert.equal((await request(bdRoute, undefined, partnerJar)).status, 401);

  const credited = partnersAfter.find(
    (row: { id: string }) => row.id === partner.id,
  );
  const lastAppearance = credited.appearances.at(-1);
  const correction = await request(
    "/api/workspace",
    {
      type: "booking.review",
      payload: { id: lastAppearance.bookingId, status: "Cancelled" },
    },
    admin,
  );
  assert.equal(correction.status, 409);
  assert.match(correction.data.error, /Reverse the BD verification/);
  const reversal = {
    action: "reverse",
    partnerId: partner.id,
    appearanceId: lastAppearance.id,
    reason: "Attendance correction",
  };
  assert.equal((await request(bdRoute, reversal, admin)).status, 200);
  assert.equal((await request(bdRoute, reversal, admin)).status, 409);
  const installment = {
    action: "pay",
    partnerId: partner.id,
    cycle: 2,
    amount: 5000,
    requestId: crypto.randomUUID(),
    paidOn: "2025-06-01",
  };
  assert.equal((await request(bdRoute, installment, admin)).status, 400);
  assert.equal(
    (
      await request(
        bdRoute,
        {
          action: "finalize",
          sessionId: lastAppearance.sessionId,
          confirmed: true,
        },
        admin,
      )
    ).status,
    200,
  );
  assert.equal((await request(bdRoute, installment, admin)).status, 200);
  assert.equal((await request(bdRoute, installment, admin)).status, 409);
  assert.equal(
    (
      await request(
        bdRoute,
        { ...installment, amount: 15001, requestId: crypto.randomUUID() },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        bdRoute,
        { ...installment, amount: 15000, requestId: crypto.randomUUID() },
        admin,
      )
    ).status,
    200,
  );
  const updatedPartner = (
    await request("/api/bd-access", undefined, partnerJar)
  ).data;
  assert.equal(
    rewardSummary(updatedPartner.appearances.length, updatedPartner.payments)
      .outstanding,
    0,
  );
  assert.equal(
    (
      await request(
        bdRoute,
        {
          action: "profile",
          partnerId: partner.id,
          xHandle: "renamed_bd",
          active: true,
        },
        admin,
      )
    ).status,
    200,
  );
  const fraudDb = new Client({ connectionString: url.toString() });
  await fraudDb.connect();
  try {
    const paidBefore = (await request("/api/bd-access", undefined, partnerJar))
      .data.appearances.length;
    async function applyViaLink(name: string, contact: string, x: string) {
      const jar: Jar = { csrf: "", cookie: "" };
      await openReferral("bd_integration", jar);
      const saved = await request(
        "/api/public/apply",
        {
          ...application,
          founderName: name,
          companyName: name + " company",
          xHandle: x,
          projectXHandle: x + "_project",
          contact,
        },
        jar,
      );
      assert.equal(saved.status, 201);
      const current = (await request("/api/workspace", undefined, admin)).data
        .state as DataState;
      const record = current.applications.find(
        (app) => app.reference === saved.data.reference,
      )!;
      const approved = await command("application.review", {
        id: record.id,
        status: "Approved",
      });
      return approved.applications.find((app) => app.id === record.id)!;
    }
    const own = await applyViaLink(
      "Self referral fixture",
      registerPartner.email,
      "self_referral",
    );
    assert.equal(own.bdReviewStatus, "self");
    const host = await applyViaLink(
      "Host fixture",
      env.BOOTSTRAP_ADMIN_EMAIL,
      "referral_host",
    );
    const claimed = await applyViaLink(
      "Competing founder A",
      "a@example.invalid",
      "competing_a",
    );
    const duplicate = await applyViaLink(
      "Competing founder B",
      "b@example.invalid",
      "competing_b",
    );
    const sessionId = "bd-fraud-test-space";
    const start = "2025-01-11T19:00:00.000Z";
    await fraudDb.query(
      `INSERT INTO "Session"(id,title,"startsAt",host,capacity,deadline,status,"updatedAt")
       VALUES ($1,'BD review fixture',$2,'@referral_host',4,$2,'Scheduled',now())`,
      [sessionId, start],
    );
    await fraudDb.query('UPDATE "Application" SET "companyId"=$2 WHERE id=$1', [
      duplicate.id,
      claimed.companyId,
    ]);
    const rows = [own, host, claimed, duplicate];
    const bookingIds = rows.map((_, index) => `bd-fraud-booking-${index}`);
    for (const [index, row] of rows.entries()) {
      await fraudDb.query(
        `INSERT INTO "BookingRequest"(id,"applicationId","sessionId",speakers,status,"updatedAt")
         VALUES($1,$2,$3,1,'Approved',now())`,
        [bookingIds[index], row.id, sessionId],
      );
    }
    const recorded = {
      type: "space-data.save",
      payload: {
        sessionId,
        submit: true,
        liveListeners: 1,
        durationMinutes: 1,
        teams: [],
        founderBookingIds: bookingIds,
      },
    };
    const foreignRoster = await request(
      "/api/workspace",
      {
        ...recorded,
        payload: {
          ...recorded.payload,
          founderBookingIds: [lastAppearance.bookingId],
        },
      },
      admin,
    );
    assert.equal(foreignRoster.status, 400);
    assert.equal(
      (await request("/api/workspace", recorded, admin)).status,
      200,
    );
    const gate = { action: "finalize", sessionId, confirmed: true };
    assert.equal(
      (await request("/api/bd-access", undefined, partnerJar)).data.appearances
        .length,
      paidBefore,
    );
    const completed = await request(bdRoute, gate, admin);
    assert.equal(completed.status, 200);
    assert.deepEqual(completed.data, { credited: 0, excluded: 4 });
    const decision = {
      action: "review-referral",
      partnerId: partner.id,
      reason: "Checked attendance and project ownership",
    };
    assert.equal(
      (
        await request(
          bdRoute,
          { ...decision, applicationId: own.id, decision: "clear" },
          admin,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request(
          bdRoute,
          { ...decision, applicationId: claimed.id, decision: "clear" },
          admin,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          bdRoute,
          { ...decision, applicationId: duplicate.id, decision: "disqualify" },
          admin,
        )
      ).status,
      200,
    );
    const accepted = await request(bdRoute, gate, admin);
    assert.equal(accepted.status, 200);
    assert.deepEqual(accepted.data, { credited: 1, excluded: 2 });
    const redacted = (await request("/api/bd-access", undefined, partnerJar))
      .data;
    assert.equal(redacted.appearances.length, paidBefore + 1);
    const ownPrivate = redacted.applications.find(
      (row: { id: string }) => row.id === own.id,
    );
    assert.equal(ownPrivate.ineligible, true);
    assert.equal(ownPrivate.bdReviewStatus, undefined);
    assert.ok(
      !JSON.stringify(redacted).includes(
        "Checked attendance and project ownership",
      ),
    );
  } finally {
    await fraudDb.end();
  }
  const renamedJar: Jar = { cookie: "", csrf: "" };
  assert.equal(
    (await openReferral("bd_integration", renamedJar)).data.handle,
    "@renamed_bd",
  );
  assert.equal(
    (
      await request(
        bdRoute,
        { action: "profile", partnerId: partner.id, active: false },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/public/referral", undefined, renamedJar)).data.valid,
    false,
  );
  assert.equal(
    (await request("/api/bd-access", undefined, partnerJar)).status,
    401,
  );
  const revokedResult = await request(
    "/api/public/apply",
    {
      ...lockedApplication,
      xHandle: "revoked_founder",
      companyName: "Revoked referral",
      projectXHandle: "revoked_project",
    },
    renamedJar,
  );
  assert.equal(revokedResult.status, 201);
  const afterRevoked = (await request("/api/workspace", undefined, admin)).data
    .state as DataState;
  assert.equal(
    afterRevoked.applications.find(
      (row) => row.reference === revokedResult.data.reference,
    )?.bdPartnerId,
    null,
  );
  pass(
    "BD links lock attribution, preserve renamed partner IDs, reject revoked credit, isolate private access, and reconcile reversals and installments",
  );

  const manualEmail = "manual-manager@integration.example.invalid";
  const generateManual = { action: "manual", email: manualEmail };
  const mailBeforeManual = mail.length;
  assert.equal(
    (await request("/api/space-managers", generateManual)).status,
    401,
  );
  assert.equal(
    (await request("/api/space-managers", generateManual, admin, false)).status,
    403,
  );
  const manualInvite = await adminManagerRequest(generateManual);
  assert.equal(manualInvite.status, 201);
  assert.match(manualInvite.headers.get("cache-control") || "", /no-store/);
  const manualUrl = new URL(manualInvite.data.link);
  assert.equal(manualUrl.origin, origin);
  assert.equal(manualUrl.pathname, "/manager/spaces");
  assert.equal(manualUrl.search, "");
  const manualToken = new URLSearchParams(manualUrl.hash.slice(1)).get(
    "token",
  )!;
  assert.match(manualToken, /^[A-Za-z0-9_-]{43}$/);
  const manualManagers = (
    await request("/api/space-managers", undefined, admin)
  ).data.managers;
  const manualManager = manualManagers.find(
    (row: { email: string }) => row.email === manualEmail,
  );
  assert.equal(manualManager.status, "Pending");
  assert.equal(manualManager.lastEmailAcceptedAt, null);
  assert.equal(manualManager.allSpaces, true);
  assert.ok(!JSON.stringify(manualManagers).includes(manualToken));

  const inviteDb = new Client({ connectionString: url.toString() });
  await inviteDb.connect();
  try {
    const tokenHash = createHash("sha256").update(manualToken).digest("hex");
    const {
      rows: [stored],
    } = await inviteDb.query(
      'SELECT "tokenHash", "expiresAt", "createdAt", "deliveredAt", manual FROM "SpaceManagerLink" WHERE "managerId"=$1',
      [manualManager.id],
    );
    assert.equal(stored.tokenHash, tokenHash);
    assert.equal(stored.manual, true);
    assert.equal(stored.deliveredAt, null);
    assert.ok(
      Math.abs(stored.expiresAt - stored.createdAt - 15 * 60_000) < 2000,
    );
    await inviteDb.query(
      `UPDATE "SpaceManagerLink" SET "expiresAt"=NOW() - INTERVAL '1 second' WHERE "tokenHash"=$1`,
      [tokenHash],
    );
    const expired = await request("/api/manager/verify", {
      token: manualToken,
    });
    assert.equal(expired.status, 401);
    assert.equal(expired.headers.get("set-cookie"), null);

    const replacement = await adminManagerRequest(generateManual);
    assert.equal(replacement.status, 201);
    const replacedToken = new URLSearchParams(
      new URL(replacement.data.link).hash.slice(1),
    ).get("token")!;
    const inviteBrowser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    let redeemedToken: string;
    try {
      const page = await inviteBrowser.newPage({
        viewport: { width: 393, height: 852 },
        permissions: ["clipboard-read", "clipboard-write"],
      });
      await page.context().addCookies([
        {
          name: "fl_session",
          value: admin.cookie.split("=")[1],
          url: origin,
        },
      ]);
      await page.goto(origin + "/owner-invitations");
      await page.getByLabel("Manager’s email").fill(manualEmail);
      await page
        .getByRole("button", { name: "Generate & Copy Invitation Link" })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Manual invitation link",
      });
      await dialog.getByRole("button", { name: "Copy", exact: true }).click();
      await dialog.getByText("Invitation link copied.").waitFor();
      const copiedUrl = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      redeemedToken = new URLSearchParams(new URL(copiedUrl).hash.slice(1)).get(
        "token",
      )!;
      await dialog.getByRole("button", { name: "Close dialog" }).click();
      assert.equal(
        await page.getByRole("textbox", { name: "Invitation link" }).count(),
        0,
      );
    } finally {
      await inviteBrowser.close();
    }
    assert.equal(
      (await request("/api/manager/verify", { token: replacedToken })).status,
      401,
    );

    const jars = Array.from({ length: 2 }, (): Jar => ({
      cookie: "",
      csrf: "",
    }));
    const redeems = await Promise.all(
      jars.map((jar) =>
        request("/api/manager/verify", { token: redeemedToken }, jar),
      ),
    );
    assert.deepEqual(
      redeems.map((response) => response.status).sort(),
      [200, 401],
    );
    const sessionJar =
      jars[redeems.findIndex((response) => response.status === 200)];
    const managerAccess = await request(
      "/api/manager/spaces",
      undefined,
      sessionJar,
    );
    assert.equal(managerAccess.status, 200);
    assert.equal(managerAccess.data.workspaceAccess, true);
    assert.ok(
      managerAccess.data.spaces.some(
        (space: { id: string }) => space.id === futureId,
      ),
    );
    assert.equal(
      (await request("/api/workspace", undefined, sessionJar)).status,
      200,
    );
    assert.equal(
      (await request("/api/space-managers", undefined, sessionJar)).status,
      401,
    );
    assert.equal(
      (
        await inviteDb.query(
          'SELECT COUNT(*)::int AS count FROM "SpaceManagerSession" WHERE "managerId"=$1',
          [manualManager.id],
        )
      ).rows[0].count,
      1,
    );
    const pending = await adminManagerRequest(generateManual);
    assert.equal(pending.status, 201);
    const pendingToken = new URLSearchParams(
      new URL(pending.data.link).hash.slice(1),
    ).get("token")!;
    assert.equal(
      (await adminManagerRequest({ action: "revoke", id: manualManager.id }))
        .status,
      200,
    );
    assert.equal(
      (await request("/api/manager/spaces", undefined, sessionJar)).status,
      401,
    );
    assert.equal(
      (await request("/api/manager/verify", { token: pendingToken })).status,
      401,
    );
    assert.equal((await adminManagerRequest(generateManual)).status, 401);
    assert.equal(mail.length, mailBeforeManual);
  } finally {
    await inviteDb.end();
  }
  pass(
    "Manual invitations are owner-only, hashed, expiring, replaceable, single-use, revocable, and grant All Spaces without sending email",
  );
  const passwordEmail = "password-manager@integration.example.invalid";
  const credentials = {
    email: passwordEmail,
    password: "Manager test phrase 1",
  };
  const resetPassword = "Manager reset phrase 2";
  const passwordLink = { action: "password-link", email: passwordEmail };
  const mailBeforePassword = mail.length;
  assert.equal(
    (await request("/api/space-managers", passwordLink)).status,
    401,
  );
  assert.equal(
    (await request("/api/space-managers", passwordLink, admin, false)).status,
    403,
  );
  async function createPasswordLink() {
    const response = await adminManagerRequest(passwordLink);
    assert.equal(response.status, 201);
    const link = new URL(response.data.link);
    assert.equal(link.pathname, "/manager/spaces");
    assert.match(link.hash, /^#setup=[A-Za-z0-9_-]{43}$/);
    return link;
  }
  const setupToken = (link: URL) =>
    new URLSearchParams(link.hash.slice(1)).get("setup")!;
  const passwordDb = new Client({ connectionString: url.toString() });
  await passwordDb.connect();
  try {
    const expired = setupToken(await createPasswordLink());
    await passwordDb.query(
      `UPDATE "SpaceManagerLink" SET "expiresAt"=now() - interval '1 minute' WHERE "tokenHash"=$1`,
      [createHash("sha256").update(expired).digest("hex")],
    );
    assert.equal(
      (
        await request("/api/manager/password-setup", {
          token: expired,
          password: credentials.password,
        })
      ).status,
      401,
    );

    const setup = await createPasswordLink();
    const raw = setupToken(setup);
    assert.equal(
      (await request("/api/manager/verify", { token: raw })).status,
      401,
    );
    const passwordBrowser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    try {
      const browserPage = await passwordBrowser.newPage({
        viewport: { width: 393, height: 852 },
      });
      await browserPage.goto(setup.href);
      await browserPage.getByLabel("New password").fill(credentials.password);
      await browserPage
        .getByLabel("Confirm password")
        .fill(credentials.password);
      await browserPage
        .getByRole("button", { name: "Save password and sign in" })
        .click();
      await browserPage.waitForURL("**/dashboard");
      await browserPage.context().clearCookies();
      await browserPage.goto(origin + "/manager/spaces");
      await browserPage
        .getByLabel("Email address", { exact: true })
        .first()
        .fill(passwordEmail);
      await browserPage
        .getByLabel("Password", { exact: true })
        .fill(credentials.password);
      await browserPage
        .getByRole("button", { name: "Sign in", exact: true })
        .click();
      await browserPage.waitForURL("**/dashboard");
    } finally {
      await passwordBrowser.close();
    }
    assert.equal(
      (
        await request("/api/manager/password-setup", {
          token: raw,
          password: resetPassword,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request("/api/manager/password-login", {
          ...credentials,
          password: "wrong",
        })
      ).status,
      401,
    );

    const ownerRecord = (
      await request("/api/space-managers", undefined, admin)
    ).data.managers.find(
      (manager: { email: string }) => manager.email === passwordEmail,
    );
    assert.equal(ownerRecord.passwordConfigured, true);
    assert.equal(ownerRecord.passwordHash, undefined);
    const stored = (
      await passwordDb.query(
        'SELECT "passwordHash" FROM "SpaceManager" WHERE id=$1',
        [ownerRecord.id],
      )
    ).rows[0].passwordHash;
    assert.match(stored, /^[a-f0-9]{32}:[a-f0-9]{128}$/);

    const previousSession: Jar = { cookie: "", csrf: "" };
    assert.equal(
      (
        await request(
          "/api/manager/password-login",
          credentials,
          previousSession,
        )
      ).status,
      200,
    );
    const resetPayload = {
      token: setupToken(await createPasswordLink()),
      password: resetPassword,
    };
    const resetResults = await Promise.all([
      request("/api/manager/password-setup", resetPayload),
      request("/api/manager/password-setup", resetPayload),
    ]);
    assert.deepEqual(
      resetResults.map(({ status }) => status).sort(),
      [200, 401],
    );
    assert.equal(
      (await request("/api/manager/spaces", undefined, previousSession)).status,
      401,
    );
    assert.equal(
      (await request("/api/manager/password-login", credentials)).status,
      401,
    );
    const newSession: Jar = { cookie: "", csrf: "" };
    assert.equal(
      (
        await request(
          "/api/manager/password-login",
          { ...credentials, password: resetPassword },
          newSession,
        )
      ).status,
      200,
    );
    assert.equal(
      (await request("/api/manager/spaces", undefined, newSession)).data
        .workspaceAccess,
      true,
    );
    assert.equal(
      (await adminManagerRequest({ action: "revoke", id: ownerRecord.id }))
        .status,
      200,
    );
    assert.equal(
      (await request("/api/manager/spaces", undefined, newSession)).status,
      401,
    );
    assert.equal(
      (
        await request("/api/manager/password-login", {
          ...credentials,
          password: resetPassword,
        })
      ).status,
      401,
    );
    assert.equal(mail.length, mailBeforePassword);
  } finally {
    await passwordDb.end();
  }
  pass(
    "Manager passwords support single-use setup, repeat sign-in, reset, session invalidation and owner revocation without email",
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
  const workspacePassword = randomBytes(24).toString("base64url");
  const sharedSignup = {
    email: "shared-owner@integration.example.invalid",
    firstName: "Programme",
    lastName: "Owner",
    x: "@owner",
    telegram: "@owner_workspace",
    password: workspacePassword,
    photo:
      "data:image/jpeg;base64," +
      readFileSync("public/owner-portrait.jpg").toString("base64"),
  };
  const signupPath = "/api/auth/signup";
  const loginPath = "/api/auth/login";
  const managerSignup = {
    ...sharedSignup,
    email: "shared-manager@integration.example.invalid",
    firstName: "Space",
    lastName: "Manager",
  };
  assert.equal(
    (
      await request(signupPath, {
        ...sharedSignup,
        email: env.BOOTSTRAP_ADMIN_EMAIL,
      })
    ).status,
    409,
  );
  assert.equal((await request(signupPath, managerSignup)).status, 201);
  assert.equal((await request(signupPath, managerSignup)).status, 409);
  const attempts = await Promise.all([
    request(signupPath, sharedSignup),
    request(signupPath, sharedSignup),
  ]);
  assert.deepEqual(attempts.map(({ status }) => status).sort(), [201, 403]);
  assert.match(
    await (await fetch(origin + "/signup")).text(),
    /Workspace registration is closed/,
  );
  const newOwner: Jar = { cookie: "", csrf: "" };
  const newManager: Jar = { cookie: "", csrf: "" };
  for (const [account, signup] of [
    [newOwner, sharedSignup],
    [newManager, managerSignup],
  ] as const) {
    assert.equal(
      (
        await request(
          loginPath,
          { email: signup.email, password: signup.password },
          account,
        )
      ).status,
      200,
    );
    const workspace = await request("/api/workspace", undefined, account);
    assert.equal(workspace.status, 200);
    account.csrf = workspace.data.viewer.csrf;
    assert.equal(
      workspace.data.viewer.name,
      signup.firstName + " " + signup.lastName,
    );
    assert.ok(workspace.data.viewer.permissions.includes("team.manage"));
    assert.equal(workspace.data.viewer.profilePhoto, signup.photo);
  }
  assert.equal(
    (
      await request(
        "/api/space-managers",
        { action: "manual", email: "retired-flow@example.invalid" },
        newManager,
      )
    ).status,
    410,
  );
  assert.equal(
    (
      await request(signupPath, {
        ...managerSignup,
        email: "closed@example.invalid",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(loginPath, {
        email: managerSignup.email,
        password: managerSignup.password,
      })
    ).status,
    200,
  );
  pass(
    "Two peers can sign up in either order and registration closes automatically without blocking login",
  );
  const telegramChecks = new Client({ connectionString: url.toString() });
  await telegramChecks.connect();
  try {
    const sessionList = (await request("/api/public/sessions")).data.sessions;
    const slot = sessionList.find(
      (entry: { bookingLocked: boolean }) => !entry.bookingLocked,
    );
    assert.ok(slot, "Active booking slot for Telegram tests");
    // Earlier tests deliberately expire or fill programme slots.
    const { startsAt, deadline } = sundaySessions(new Date(), 1)[0];
    await telegramChecks.query(
      `UPDATE "Session" SET "startsAt"=$2, deadline=$3, status='Scheduled',
         capacity=GREATEST(capacity, (SELECT count(DISTINCT "companyId") + 1
           FROM "SessionParticipant" WHERE "sessionId"=$1 AND attendance <> 'Cancelled'))
       WHERE id=$1`,
      [slot.id, startsAt, deadline],
    );
    const managerToken = randomBytes(32).toString("base64url");
    const managerCsrf = randomBytes(32).toString("base64url");
    const telegramManagerEmail = "telegram-manager@example.invalid";
    await telegramChecks.query(
      'INSERT INTO "SpaceManager" (id, email, "allSpaces", "verifiedAt") VALUES ($1, $2, true, now())',
      ["telegram-manager", telegramManagerEmail],
    );
    await telegramChecks.query(
      'INSERT INTO "SpaceManagerSession" (id, "managerId", "tokenHash", csrf, "expiresAt") VALUES ($1, $2, $3, $4, now() + interval \'1 hour\')',
      [
        "telegram-manager-session",
        "telegram-manager",
        createHash("sha256").update(managerToken).digest("hex"),
        managerCsrf,
      ],
    );
    const telegramManager = {
      cookie: `fl_space_manager=${managerToken}`,
      csrf: managerCsrf,
    };
    async function telegramBooking(founderName: string, xHandle: string) {
      const submitted = await request("/api/public/apply", {
        ...application,
        founderName,
        companyName: `${founderName} project`,
        xHandle,
        sessionId: slot.id,
      });
      assert.equal(submitted.status, 201, JSON.stringify(submitted.data));
      const records = (await request("/api/workspace", undefined, newOwner))
        .data.state as DataState;
      const founder = records.applications.find(
        (entry) => entry.reference === submitted.data.reference,
      )!;
      return records.bookings.find(
        (entry) => entry.applicationId === founder.id,
      )!;
    }
    const booked = await telegramBooking(
      "Telegram manager founder",
      "telegram_mgr",
    );
    const approve = {
      type: "application.review",
      payload: { id: booked.applicationId, status: "Approved" },
    };
    assert.equal((await request("/api/workspace", approve)).status, 401);
    assert.equal(
      (await request("/api/workspace", approve, telegramManager, false)).status,
      403,
    );
    await command(approve.type, approve.payload, telegramManager);
    await command(approve.type, approve.payload, telegramManager);
    const notification = async (bookingId: string) =>
      (
        await telegramChecks.query(
          'SELECT * FROM "BookingTelegramNotification" WHERE "bookingId"=$1',
          [bookingId],
        )
      ).rows[0];
    await expect
      .poll(async () => (await notification(booked.id))?.approvalState)
      .toBe("sent");
    const delivered = await notification(booked.id);
    const threaded = telegram.filter(
      ({ payload }) =>
        payload.reply_parameters?.message_id ===
        Number(delivered.originalMessageId),
    );
    assert.equal(threaded.length, 1);
    assert.match(threaded[0].payload.text, /Founder: Telegram manager founder/);
    assert.ok(
      threaded[0].payload.text.includes(`Approved by: ${telegramManagerEmail}`),
    );
    assert.match(threaded[0].payload.text, /Role: Space Manager/);
    assert.equal(delivered.approverId, "telegram-manager");
    await command(
      "application.review",
      { id: booked.applicationId, status: "Declined" },
      telegramManager,
    );
    const outage = await telegramBooking(
      "Telegram outage founder",
      "telegram_outage",
    );
    await expect
      .poll(async () => (await notification(outage.id))?.initialState)
      .toBe("unknown");
    const recovered = await command(
      "application.review",
      { id: outage.applicationId, status: "Approved" },
      telegramManager,
    );
    assert.equal(
      recovered.bookings.find((entry) => entry.id === outage.id)?.status,
      "Approved",
    );
    const undelivered = await notification(outage.id);
    assert.ok(undelivered.approvedAt);
    assert.equal(undelivered.originalMessageId, null);
    assert.equal(undelivered.approvalMessageId, null);
    assert.equal(
      telegram.filter(({ payload }) =>
        payload.text.includes("Telegram outage founder"),
      ).length,
      1,
    );
    pass(
      "Authorised Space Manager approval is threaded and Telegram downtime does not affect booking or approval",
    );
  } finally {
    await telegramChecks.end();
  }
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
  await new Promise<void>((resolve) => telegramServer.close(() => resolve()));
}
