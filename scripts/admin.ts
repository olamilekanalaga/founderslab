export {};
try {
  process.loadEnvFile(".env");
} catch {}

const { z } = await import("zod");
const { db, ensureRoles } = await import("@/server/db/node");
const { passwordHash } = await import("@/server/auth/passwords");
const email = z
  .email()
  .parse(process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase());
const client = db();
try {
  const existing = await client.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!existing) {
    const password = z
      .string()
      .min(12)
      .max(200)
      .parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
    await ensureRoles();
    await client.user.upsert({
      where: { email },
      create: {
        email,
        name: process.env.BOOTSTRAP_ADMIN_NAME || "Programme administrator",
        passwordHash: passwordHash(password),
        roleId: "admin",
      },
      update: {},
    });
  }
  console.log(
    "Administrator account is available. Existing passwords were not changed.",
  );
} finally {
  await client.$disconnect();
}
