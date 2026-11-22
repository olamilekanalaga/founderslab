/** Runs only inside a production Vercel build, using its already connected database. */
import { spawnSync } from "node:child_process";
import { databaseUrl, migrationUrl } from "../lib/server-env";
if (process.env.VERCEL_ENV !== "production") {
  console.log("Production database preparation skipped for this environment.");
  process.exit(0);
}
if (!process.env.VERCEL_PROJECT_ID)
  throw new Error(
    "Production preparation requires the linked Vercel project context.",
  );
const application = databaseUrl(),
  direct = migrationUrl();
if (!application || !direct)
  throw new Error(
    "Connect Neon to Production: DATABASE_URL and DATABASE_URL_UNPOOLED are required. Connection values are never logged.",
  );
for (const value of [application, direct]) {
  let valid = false;
  try {
    valid = ["postgres:", "postgresql:"].includes(new URL(value).protocol);
  } catch {}
  if (!valid)
    throw new Error("Database connection must be a valid PostgreSQL URL.");
}
function run(script: string, url: string) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  // Successful scripts print only migration names and summaries, never credentials.
  if (result.status !== 0) {
    console.error(
      `Database preparation failed in ${script}. No connection values were logged.`,
    );
    process.exit(1);
  }
  process.stdout.write(result.stdout);
}
console.log(
  "Preparing the connected production database; no fictional founders will be inserted.",
);
run("scripts/migrate.ts", direct);
run("scripts/seed.ts", application);
run("scripts/publish-saturdays.ts", application);
if (process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
  run("scripts/admin.ts", application);
} else {
  console.log(
    "Tables and programme defaults are ready. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in Production, then redeploy to provision your administrator.",
  );
}
