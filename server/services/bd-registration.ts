import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { bdRegistration } from "@/lib/validation/bd-partner";

export async function registerBdPartner(
  tx: Prisma.TransactionClient,
  {
    name,
    email,
    bank,
    accountName,
    accountNumber,
  }: z.infer<typeof bdRegistration>,
  actor: string,
  detail: string,
) {
  const partner = await tx.bdPartner.create({
    data: {
      id: randomUUID(),
      name,
      email: email.toLowerCase(),
      bankDetails: JSON.stringify({ bank, accountName, accountNumber }),
    },
    select: { id: true },
  });
  await tx.auditLog.create({
    data: { actor, action: "bd.register", entityId: partner.id, detail },
  });
}
