import { migrationUrl } from "@/server/config/environment";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
try {
  process.loadEnvFile(".env");
} catch {}
const connectionString = migrationUrl();
if (!connectionString)
  throw new Error("Set DATABASE_URL before running migrations");
const client = new Client({ connectionString });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(64323729)");
  await client.query(
    'CREATE TABLE IF NOT EXISTS "_founders_migrations" (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await readdir("prisma/migrations")).sort()) {
    if (name.endsWith(".toml")) continue;
    const sql = await readFile(
      `prisma/migrations/${name}/migration.sql`,
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      'SELECT checksum FROM "_founders_migrations" WHERE name=$1',
      [name],
    );
    if (existing.rows.length) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error(
          `Applied migration ${name} has changed. Create a new migration instead.`,
        );
      continue;
    }
    await client.query(sql);
    await client.query(
      'INSERT INTO "_founders_migrations"(name,checksum) VALUES($1,$2)',
      [name, checksum],
    );
    console.log("Applied migration:", name);
  }
  await client.query("COMMIT");
  console.log("Database migrations are up to date.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
