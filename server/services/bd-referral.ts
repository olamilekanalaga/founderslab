import "server-only";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { hash } from "@/server/security/tokens";

export const BD_REFERRAL_COOKIE = "fl_bd_referral";
export const REFERRAL_SECONDS = 86400;

export function referralCode(value: string) {
  const normalized = value.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9_]{1,64}$/.test(normalized) ? normalized : "";
}

export async function referralSelection() {
  return (await cookies()).get(BD_REFERRAL_COOKIE)?.value;
}

export async function activeReferral(
  client: Prisma.TransactionClient,
  selection: string,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(selection)) return null;
  const row = await client.bdAccess.findFirst({
    where: {
      tokenHash: hash(selection),
      purpose: "referral",
      expiresAt: { gt: new Date() },
      partner: { active: true },
    },
    select: { partner: { select: { id: true, name: true } } },
  });
  return row?.partner ?? null;
}
