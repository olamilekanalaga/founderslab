import type { DataState } from "@/lib/types";
import { REFERRALS_PER_CYCLE, REWARD_NAIRA } from "./rewards";

export interface Partner {
  id: string;
  name: string;
  fullName: string | null;
  email: string;
  referralCode: string;
  active: boolean;
  createdAt: string;
  appearances: {
    id: string;
    bookingId: string;
    sessionId: string;
    companyId: string;
    ordinal: number;
    verifiedAt: string;
    reversedAt: string | null;
  }[];
  payments: {
    id: string;
    cycle: number;
    amount: number;
    paidOn: string;
    reference: string | null;
  }[];
}

export const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

type Application = DataState["applications"][number];

export function bdIntelligence(
  partners: Partner[],
  applications: Application[],
  month = "",
) {
  const within = (date: string) => !month || date.startsWith(month);
  const acquired = new Set<string>();
  const rows = partners.map((partner) => {
    const referrals = applications.filter(
      (application) =>
        application.bdPartnerId === partner.id && within(application.createdAt),
    );
    for (const referral of referrals) {
      if (referral.status === "Approved" && referral.founderId)
        acquired.add(referral.founderId);
    }
    const appearances = partner.appearances
      .filter((appearance) => !appearance.reversedAt)
      .toSorted(
        (a, b) =>
          a.verifiedAt.localeCompare(b.verifiedAt) || a.ordinal - b.ordinal,
      );
    const verified = appearances.filter((appearance) =>
      within(appearance.verifiedAt),
    ).length;
    const cycles = appearances.filter(
      (appearance, index) =>
        (index + 1) % REFERRALS_PER_CYCLE === 0 &&
        within(appearance.verifiedAt),
    ).length;
    const paid = partner.payments
      .filter((payment) => within(payment.paidOn))
      .reduce((sum, payment) => sum + payment.amount, 0);
    const earned = cycles * REWARD_NAIRA;
    return {
      partner,
      applications: referrals.length,
      verified,
      cycles,
      earned,
      paid,
      outstanding: earned - paid,
    };
  });
  return {
    rows,
    acquired: acquired.size,
    totals: rows.reduce(
      (total, row) => ({
        registered: total.registered + 1,
        active: total.active + Number(row.partner.active),
        applications: total.applications + row.applications,
        verified: total.verified + row.verified,
        cycles: total.cycles + row.cycles,
        earned: total.earned + row.earned,
        paid: total.paid + row.paid,
        outstanding: total.outstanding + row.outstanding,
        recipients: total.recipients + Number(row.paid > 0),
      }),
      {
        registered: 0,
        active: 0,
        applications: 0,
        verified: 0,
        cycles: 0,
        earned: 0,
        paid: 0,
        outstanding: 0,
        recipients: 0,
      },
    ),
  };
}
