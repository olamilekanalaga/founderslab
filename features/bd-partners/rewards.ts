export const REFERRALS_PER_CYCLE = 4;
export const REWARD_NAIRA = 20_000;

export function rewardSummary(
  verified: number,
  payments: { cycle: number; amount: number }[],
) {
  const completedCycles = Math.floor(verified / REFERRALS_PER_CYCLE);
  const paidCycles = payments.length;
  const earned = completedCycles * REWARD_NAIRA;
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    verified,
    cycleProgress:
      verified % REFERRALS_PER_CYCLE || (verified ? REFERRALS_PER_CYCLE : 0),
    completedCycles,
    paidCycles,
    unpaidCycles: completedCycles - paidCycles,
    earned,
    paid,
    outstanding: earned - paid,
  };
}
