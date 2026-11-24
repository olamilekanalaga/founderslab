import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { DomainError } from "@/lib/domain";
import type { bdRegistration } from "@/lib/validation/bd-partner";

export function findBdPartnersByHandle(
  tx: Prisma.TransactionClient,
  username: string,
) {
  return tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "BdPartner"
    WHERE active AND lower(name) = lower(${username})
    LIMIT 2
  `;
}

export async function registerBdPartner(
  tx: Prisma.TransactionClient,
  {
    name,
    fullName,
    email,
    bank,
    accountName,
    accountNumber,
  }: z.infer<typeof bdRegistration>,
  actor: string,
  detail: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"bd-handle:" + name}))`;
  const referralCode = name.slice(1);
  const duplicate = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "BdPartner" WHERE lower(name) = lower(${name}) OR "referralCode" = ${referralCode} LIMIT 1
  `;
  if (duplicate.length)
    throw new DomainError(
      "This X username is already registered to a BD partner.",
      409,
    );

  const partner = await tx.bdPartner.create({
    data: {
      id: randomUUID(),
      name,
      fullName,
      referralCode,
      email: email.toLowerCase(),
      bankDetails: JSON.stringify({ bank, accountName, accountNumber }),
    },
    select: { id: true },
  });
  await tx.auditLog.create({
    data: { actor, action: "bd.register", entityId: partner.id, detail },
  });
  return { id: partner.id, referralCode };
}
