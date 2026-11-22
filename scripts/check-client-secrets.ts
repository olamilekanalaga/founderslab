/** Reports only pass/fail and variable names, never secret values. */
import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
try {
  process.loadEnvFile(".env");
} catch {}
const paths = await readdir(".next/static", { recursive: true });
const sources = await Promise.all(
  paths
    .filter((p) => p.endsWith(".js"))
    .map((p) => readFile(`.next/static/${p}`, "utf8")),
);
const bundle = sources.join("\n");
for (const name of [
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PASSWORD",
  "DATABASE_URL",
  "DATABASE_DATABASE_URL",
  "RESEND_API_KEY",
]) {
  // Configuration key labels in Admin setup help are public names, not credentials.
  if (
    bundle.includes(`process.env.${name}`) ||
    bundle.includes(`process.env["${name}"]`)
  )
    throw new Error(
      `Server-only configuration name found in browser bundle: ${name}`,
    );
  const value = process.env[name];
  if (value && value.length > 8 && bundle.includes(value))
    throw new Error(`Configured secret value found in browser bundle: ${name}`);
}
for (const sample of ["Amara Okafor", "KoraLane", "founders-lab-demo-v1"])
  if (bundle.includes(sample))
    throw new Error("Removed browser fixture data is still bundled.");
const tracked = execFileSync(
  "git",
  ["ls-files", "--", ".env", ".env.local", ".env.production"],
  { encoding: "utf8" },
).trim();
if (tracked) throw new Error("A private environment file is tracked in Git.");
console.log(
  "PASS: browser bundles contain no checked server credentials or removed fixture dataset; private environment files are not tracked.",
);
