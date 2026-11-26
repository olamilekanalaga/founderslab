import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { passwordHash, rateLimit } from "@/server/auth";
import { body, json } from "@/server/http";
import { DomainError } from "@/lib/domain";

const setting = "workspace.signup";
const maximumAccounts = 2;
const signupAccounts = {
  roleId: "admin",
  signupProfile: { not: Prisma.DbNull },
};
const input = z
  .object({
    key: z.string().trim().min(32).max(200),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    x: z
      .string()
      .trim()
      .regex(/^@?[A-Za-z0-9_]{1,15}$/),
    telegram: z
      .string()
      .trim()
      .regex(/^@?[A-Za-z0-9_]{1,32}$/),
    password: z.string().min(1).max(128),
    photo: z
      .string()
      .max(200000)
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();

export async function workspaceSignupEnabled() {
  if ((process.env.WORKSPACE_SIGNUP_KEY?.length ?? 0) < 32) return false;
  const [status, registered] = await Promise.all([
    db().setting.findUnique({ where: { key: setting } }),
    db().user.count({ where: signupAccounts }),
  ]);
  return status?.value !== false && registered < maximumAccounts;
}

export async function registerWorkspaceAdmin(request: Request) {
  const secret = process.env.WORKSPACE_SIGNUP_KEY;
  if (!secret || secret.length < 32)
    throw new DomainError("Registration is closed.", 404);
  await rateLimit(
    `workspace-signup:${request.headers.get("x-forwarded-for") || "local"}`,
    15,
    900000,
  );
  const { key, email, firstName, lastName, x, telegram, password, photo } =
    input.parse(await body(request));
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(key), digest(secret)))
    throw new DomainError(
      "This signup link is invalid or registration is closed.",
      403,
    );
  const bytes = Buffer.from(
    photo.slice("data:image/jpeg;base64,".length),
    "base64",
  );
  if (
    bytes.length < 5 ||
    !bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
    !bytes.subarray(-2).equals(Buffer.from([255, 217]))
  )
    throw new DomainError("Upload a valid profile photo.", 400);
  const credentials = passwordHash(password);
  const profile = { firstName, lastName, x, telegram, photo };
  await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Role" WHERE id = 'admin' FOR UPDATE`;
    const status = await tx.setting.findUnique({ where: { key: setting } });
    const registered = await tx.user.count({ where: signupAccounts });
    if (status?.value === false || registered >= maximumAccounts)
      throw new DomainError("Registration is closed.", 403);
    if (await tx.user.findUnique({ where: { email }, select: { id: true } }))
      throw new DomainError(
        "An account already uses that email. Sign in or use a different email.",
        409,
      );
    const account = await tx.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        passwordHash: credentials,
        signupProfile: profile,
        email,
        roleId: "admin",
      },
    });
    const closed = registered + 1 === maximumAccounts;
    if (closed) {
      await tx.setting.upsert({
        where: { key: setting },
        create: { key: setting, value: false },
        update: { value: false },
      });
    }
    await tx.auditLog.create({
      data: {
        actor: email,
        action: "workspace.signup",
        entityId: account.id,
        detail: closed
          ? "Second workspace account registered. Shared signup closed automatically."
          : "Full workspace account registered.",
      },
    });
  });
  return json({ ok: true }, 201);
}

export async function closeWorkspaceSignup(accountId: string, actor: string) {
  await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Role" WHERE id = 'admin' FOR UPDATE`;
    const account = await tx.user.findUnique({
      where: { id: accountId },
      select: { signupProfile: true },
    });
    if (!account?.signupProfile)
      throw new DomainError("Complete workspace signup first.", 403);
    await tx.setting.upsert({
      where: { key: setting },
      create: { key: setting, value: false },
      update: { value: false },
    });
    await tx.auditLog.create({
      data: {
        actor,
        action: "workspace.signup.close",
        entityId: accountId,
        detail: "Shared signup link disabled.",
      },
    });
  });
}
