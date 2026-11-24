import "server-only";
import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { z } from "zod";
import { passwordHash, verifyPassword } from "@/server/auth/passwords";
import { rateLimit } from "@/server/auth";
import { db, hash, token } from "@/server/db";
import { body, json } from "@/server/http";
import { DomainError } from "@/lib/domain";
import { lockManager, MANAGER_COOKIE } from "./space-managers";

const sessionSeconds = 8 * 3600;
const loginPassword = z.string().min(1).max(128);
const dummyHash = `${"0".repeat(32)}:${"0".repeat(128)}`;

export async function managerPasswordAuth(
  request: Request,
  action: "password-login" | "password-setup",
) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  await rateLimit(`manager-${action}-ip:${ip}`, 25, 15 * 60000);
  const payload = await body(request);
  const rawSession = token();

  async function signIn(
    tx: Prisma.TransactionClient,
    manager: { id: string; email: string },
  ) {
    const now = new Date();
    await tx.spaceManager.update({
      where: { id: manager.id },
      data: { verifiedAt: now, lastActivityAt: now },
    });
    await tx.spaceManagerSession.create({
      data: {
        managerId: manager.id,
        tokenHash: hash(rawSession),
        csrf: token(),
        expiresAt: new Date(now.getTime() + sessionSeconds * 1000),
      },
    });
    await tx.auditLog.create({
      data: {
        actor: manager.email,
        action: "manager.login",
        entityId: manager.id,
        detail: "Signed in using a manager password.",
      },
    });
  }

  if (action === "password-login") {
    const { email, password } = z
      .object({
        email: z.string().trim().toLowerCase().pipe(z.email()),
        password: loginPassword,
      })
      .parse(payload);
    await rateLimit(`manager-password-account:${email}`, 8, 15 * 60000);
    const manager = await db().spaceManager.findUnique({
      where: { email },
      select: { id: true, revokedAt: true, passwordHash: true },
    });
    const invalid = () =>
      new DomainError("Email or password is incorrect.", 401);
    const valid = verifyPassword(password, manager?.passwordHash ?? dummyHash);
    if (!manager?.passwordHash || manager.revokedAt || !valid) throw invalid();
    await db().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SpaceManager" WHERE id = ${manager.id} FOR UPDATE`;
      const current = await tx.spaceManager.findUnique({
        where: { id: manager.id },
      });
      if (
        !current ||
        current.revokedAt ||
        current.passwordHash !== manager.passwordHash
      )
        throw invalid();
      await signIn(tx, current);
    });
  } else {
    const { token: raw, password } = z
      .object({
        token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        password: loginPassword.min(15, "Use at least 15 characters."),
      })
      .parse(payload);
    const invalid = () =>
      new DomainError(
        "This setup link is invalid, expired or already used.",
        401,
      );
    const found = await db().spaceManagerLink.findUnique({
      where: { tokenHash: hash(raw) },
    });
    if (
      !found?.passwordSetup ||
      !found.manual ||
      found.usedAt ||
      found.expiresAt <= new Date()
    )
      throw invalid();
    const encoded = passwordHash(password);
    await db().$transaction(async (tx) => {
      const manager = await lockManager(tx, found.managerId);
      const claimed = await tx.spaceManagerLink.updateMany({
        where: {
          id: found.id,
          passwordSetup: true,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw invalid();
      await tx.spaceManager.update({
        where: { id: manager.id },
        data: { passwordHash: encoded },
      });
      await tx.spaceManagerSession.deleteMany({
        where: { managerId: manager.id },
      });
      await tx.spaceManagerLink.updateMany({
        where: { managerId: manager.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actor: manager.email,
          action: manager.passwordHash
            ? "manager.password.reset"
            : "manager.password.set",
          entityId: manager.id,
          detail:
            "Password saved and previous sessions and unused links invalidated.",
        },
      });
      await signIn(tx, manager);
    });
  }

  (await cookies()).set(MANAGER_COOKIE, rawSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionSeconds,
  });
  return json({ ok: true });
}
