import test from "node:test";
import assert from "node:assert/strict";
import { databaseUrl, migrationUrl } from "@/lib/server-env";
test("Neon prefixed variables resolve without replacing a canonical connection", () => {
  assert.equal(
    databaseUrl({ DATABASE_URL: "primary", DATABASE_DATABASE_URL: "prefixed" }),
    "primary",
  );
  assert.equal(databaseUrl({ DATABASE_DATABASE_URL: "prefixed" }), "prefixed");
  assert.equal(databaseUrl({ STORAGE_DATABASE_URL: "storage" }), "storage");
  assert.equal(
    migrationUrl({ DATABASE_DATABASE_URL_UNPOOLED: "direct" }),
    "direct",
  );
  assert.throws(
    () =>
      migrationUrl({
        DATABASE_URL:
          "postgresql://u:p@ep-demo-pooler.us-east-1.aws.neon.tech/db",
      }),
    /UNPOOLED/,
  );
});
