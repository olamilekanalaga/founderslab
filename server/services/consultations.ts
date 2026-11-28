import "server-only";
import type { Prisma } from "@prisma/client";
import { clinicSettings, consultationSettingsKey } from "@/lib/consultations";
import { db } from "@/server/db";
import { firstBookableTime } from "@/server/services/consultation-payments";

type Client = Prisma.TransactionClient;
export const activeAppointment = {
  bookingStatus: { not: "Cancelled" },
} as const;
export const appointmentSelect = {
  id: true,
  bookingStatus: true,
  paymentStatus: true,
  feePence: true,
  slot: { select: { startsAt: true, endsAt: true } },
} satisfies Prisma.ConsultationAppointmentSelect;

export async function readClinicSettings(client: Client = db()) {
  const row = await client.setting.findUnique({
    where: { key: consultationSettingsKey },
  });
  return clinicSettings.safeParse(row?.value).data ?? null;
}

export function availableSlots(client: Client = db()) {
  return client.consultationSlot.findMany({
    where: {
      startsAt: { gt: firstBookableTime() },
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
