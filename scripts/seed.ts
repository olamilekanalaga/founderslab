export {};
try {
  process.loadEnvFile(".env");
} catch {}
const { db, ensureRoles, loadState, persistDiff } = await import("../lib/db");
const { makeSeed } = await import("../lib/seed");
await ensureRoles();
const seed = makeSeed();
for (const label of seed.labels)
  await db().classificationLabel.upsert({
    where: { group_name: { group: label.group, name: label.name } },
    create: label,
    update: {},
  });
if (process.argv.includes("--demo")) {
  const count = await db().founder.count();
  if (count)
    throw new Error(
      "Demo seeding requires a database without founder records. Never mix seed fixtures into a production programme.",
    );
  await db().$transaction(
    async (tx) => {
      const before = await loadState(tx);
      await persistDiff(
        tx,
        before,
        { ...seed, users: before.users, labels: before.labels },
        true,
      );
      await tx.setting.upsert({
        where: { key: "dataset" },
        create: { key: "dataset", value: true },
        update: { value: true },
      });
    },
    { timeout: 60000 },
  );
  console.log(
    "Seeded 50 fictional founders, shared sessions and demo programme records.",
  );
} else
  console.log(
    "Roles, permissions, taxonomies and programme defaults ready. No fictional founders were inserted.",
  );
await db().$disconnect();
