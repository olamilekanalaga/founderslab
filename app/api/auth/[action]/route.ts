import { z } from "zod";
import { body, json, failure } from "@/lib/http";
import { db, hash } from "@/lib/db";
import {
  getViewer,
  requireViewer,
  requireCsrf,
  requireOrigin,
  rateLimit,
  startSession,
  endSession,
  passwordHash,
  verifyPassword,
} from "@/lib/auth";
import { DomainError } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    if ((await params).action !== "me")
      return json({ error: "Not found" }, 404);
    const viewer = await getViewer();
    return viewer ? json({ viewer }) : json({ error: "Sign in required" }, 401);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    requireOrigin(request);
    if (action === "login") {
      const p = z
        .object({
          email: z.email().transform((v) => v.toLowerCase()),
          password: z.string().min(1).max(200),
        })
        .parse(await body(request));
      await rateLimit(
        `login:${p.email}:${request.headers.get("x-forwarded-for") || "local"}`,
        8,
        15 * 60000,
      );
      const user = await db().user.findUnique({ where: { email: p.email } });
      const encoded =
        user?.passwordHash ||
        "0123456789abcdef:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      const valid = verifyPassword(p.password, encoded);
      if (!user || !user.active || !valid)
        throw new DomainError("Email or password is incorrect.", 401);
      await startSession(user.id);
      return json({ ok: true });
    }
    if (action === "logout") {
      const viewer = await requireViewer();
      requireCsrf(request, viewer);
      await endSession();
      return json({ ok: true });
    }
    if (action === "accept-invite") {
      const p = z
        .object({
          token: z.string().min(30).max(100),
          password: z.string().min(12, "Use at least 12 characters").max(200),
        })
        .parse(await body(request));
      await rateLimit(
        `invite:${request.headers.get("x-forwarded-for") || "local"}`,
        15,
        15 * 60000,
      );
      const userId = await db().$transaction(async (tx) => {
        const found = await tx.invitation.findUnique({
          where: { tokenHash: hash(p.token) },
        });
        if (!found || found.acceptedAt || found.expiresAt < new Date())
          throw new DomainError("This invitation is invalid or expired.", 400);
        const claim = await tx.invitation.updateMany({
          where: { id: found.id, acceptedAt: null },
          data: { acceptedAt: new Date() },
        });
        if (claim.count !== 1)
          throw new DomainError("Invitation already accepted.");
        const user = await tx.user.create({
          data: {
            email: found.email,
            name: found.name,
            passwordHash: passwordHash(p.password),
            roleId: found.roleId,
          },
        });
        return user.id;
      });
      await startSession(userId);
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return failure(e);
  }
}
