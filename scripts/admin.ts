export {};
try {
  process.loadEnvFile(".env");
} catch {}
const { z } = await import("zod");
const { db, ensureRoles } = await import("@/lib/db");
const { passwordHash } = await import("@/lib/auth");
const email = z.email().parse(process.env.BOOTSTRAP_ADMIN_EMAIL).toLowerCase();
const password = z
  .string()
  .min(12)
  .max(200)
  .parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
await ensureRoles();
await db().user.upsert({
  where: { email },
  create: {
    email,
    name: process.env.BOOTSTRAP_ADMIN_NAME || "Programme administrator",
    passwordHash: passwordHash(password),
    roleId: "admin",
  },
  update: {},
});
console.log(
  "Administrator account is available. Existing passwords were not changed.",
);
await db().$disconnect();
