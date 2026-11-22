import "server-only";
import { databaseUrl } from "@/server/config/environment";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { db, hash, token } from "@/server/db";
import { DomainError } from "@/lib/domain";
import type { Viewer } from "@/lib/types";
export function isProvisionedAdmin(user: {
  email: string;
  roleId: string;
  active: boolean;
}) {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(
    email &&
    user.active &&
    user.roleId === "admin" &&
    user.email.toLowerCase() === email,
  );
}
export async function getViewer(): Promise<Viewer | null> {
  if (!databaseUrl()) return null;
  const value = (await cookies()).get("fl_session")?.value;
  if (!value) return null;
  const session = await db().authSession.findUnique({
    where: { tokenHash: hash(value) },
    include: {
      user: {
        include: { role: { include: { permissions: true } }, grants: true },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active)
    return null;
  const u = session.user;
  if (!isProvisionedAdmin(u)) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    roleId: u.roleId,
    permissions: u.customPermissions
      ? u.grants.map((p) => p.permissionId)
      : u.role.permissions.map((p) => p.permissionId),
    csrf: session.csrf,
  };
}
export async function requireViewer(permission?: string) {
  const v = await getViewer();
  if (!v)
    throw new DomainError("Sign in to access the private workspace.", 401);
  if (permission && !v.permissions.includes(permission))
    throw new DomainError("Permission required.", 403);
  return v;
}
export function requireOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== new URL(expected).origin)
    throw new DomainError("Request origin rejected.", 403);
}
export function requireCsrf(request: Request, viewer: Viewer) {
  requireOrigin(request);
  const incoming = request.headers.get("x-csrf-token") || "",
    expected = viewer.csrf || "";
  if (
    !expected ||
    Buffer.byteLength(incoming) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))
  )
    throw new DomainError("Session request token required.", 403);
}
export async function startSession(userId: string) {
  const raw = token(),
    csrf = token();
  await db().authSession.create({
    data: {
      userId,
      tokenHash: hash(raw),
      csrf,
      expiresAt: new Date(Date.now() + 7 * 864e5),
    },
  });
  (await cookies()).set("fl_session", raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 86400,
  });
  return csrf;
}
export async function endSession() {
  const store = await cookies(),
    raw = store.get("fl_session")?.value;
  if (raw)
    await db().authSession.deleteMany({ where: { tokenHash: hash(raw) } });
  store.delete("fl_session");
}
export async function rateLimit(key: string, max: number, windowMs: number) {
  const now = new Date(),
    record = await db().rateLimit.upsert({
      where: { key: hash(key) },
      create: { key: hash(key), count: 1, windowStart: now },
      update: { count: { increment: 1 } },
    });
  if (now.getTime() - record.windowStart.getTime() > windowMs) {
    await db().rateLimit.update({
      where: { key: record.key },
      data: { count: 1, windowStart: now },
    });
    return;
  }
  if (record.count > max)
    throw new DomainError("Too many requests. Please try again later.", 429);
}
