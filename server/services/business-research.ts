import "server-only";
import type { Prisma } from "@prisma/client";

export const activeResearchBookings = {
  status: { in: ["Pending", "Approved", "Attended", "No-show", "Waitlisted"] },
} satisfies Prisma.BookingRequestWhereInput;

export const discoveryLinkEligible = {
  status: { not: "Declined" },
  bookings: { some: activeResearchBookings },
} satisfies Prisma.ApplicationWhereInput;

export const researchQueueEligible = {
  status: { not: "Declined" },
  OR: [
    { bookings: { some: activeResearchBookings } },
    { businessResearch: { isNot: null } },
  ],
} satisfies Prisma.ApplicationWhereInput;
