import "server-only";
import type { Prisma } from "@prisma/client";
import { sessionSettings, consultationSettingsKey } from "@/lib/consultations";
import { db } from "@/server/db";

type Client = Prisma.TransactionClient;
export const activeAppointment = {
  bookingStatus: { not: "Cancelled" },
} as const;

export const appointmentSelect = {
  id: true,
  bookingStatus: true,
  slot: { select: { startsAt: true, endsAt: true } },
} satisfies Prisma.ConsultationAppointmentSelect;

export async function readSessionSettings(client: Client = db()) {
  const row = await client.setting.findUnique({
    where: { key: consultationSettingsKey },
  });
  return sessionSettings.safeParse(row?.value).data ?? null;
}

export function availableSlots() {
  return db().consultationSlot.findMany({
    where: {
      startsAt: { gt: new Date() },
      withdrawnAt: null,
      appointments: { none: activeAppointment },
    },
    select: { id: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
}

export async function lockAppointment(tx: Client, id: string) {
  await tx.$queryRaw`SELECT id FROM "ConsultationAppointment" WHERE id = ${id} FOR UPDATE`;
  return tx.consultationAppointment.findUnique({
    where: { id },
    include: { slot: true },
  });
}
