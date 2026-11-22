import { z } from "zod";
import { body, json, failure } from "@/lib/http";
import { db } from "@/lib/db";
import {
  getViewer,
  requireViewer,
  requireCsrf,
  requireOrigin,
  rateLimit,
  startSession,
  endSession,
  isProvisionedAdmin,
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
      await rateLimit(`login-account:${p.email}`, 8, 15 * 60000);
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
      if (!user || !isProvisionedAdmin(user) || !valid)
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
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return failure(e);
  }
}
