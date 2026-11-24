import "server-only";
import { NextResponse } from "next/server";
import { databaseUrl } from "@/server/config/environment";
import { db, hash, token } from "@/server/db";
import {
  BD_REFERRAL_COOKIE,
  REFERRAL_SECONDS,
  referralCode,
} from "@/server/services/bd-referral";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/#choose-a-sunday", url));
  response.headers.set("Cache-Control", "private, no-store");
  if (!url.searchParams.has("ref")) {
    response.cookies.delete(BD_REFERRAL_COOKIE);
    return response;
  }
  const code = referralCode(url.searchParams.get("ref") || "");
  const partner =
    code && databaseUrl()
      ? await db().bdPartner.findFirst({
          where: { referralCode: code, active: true },
          select: { id: true },
        })
      : null;
  let selection = "!";
  if (partner) {
    selection = token();
    await db().$transaction([
      db().bdAccess.deleteMany({
        where: { purpose: "referral", expiresAt: { lte: new Date() } },
      }),
      db().bdAccess.create({
        data: {
          tokenHash: hash(selection),
          partnerId: partner.id,
          purpose: "referral",
          expiresAt: new Date(Date.now() + REFERRAL_SECONDS * 1000),
        },
      }),
    ]);
  }
  response.cookies.set(BD_REFERRAL_COOKIE, selection, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFERRAL_SECONDS,
  });
  return response;
}
