export const REFERRALS_PER_CYCLE = 4;
export const REWARD_NAIRA = 20_000;

export function rewardSummary(
  verified: number,
  payments: { cycle: number; amount: number }[],
) {
  const completedCycles = Math.floor(verified / REFERRALS_PER_CYCLE);
  const byCycle = new Map<number, number>();
  for (const payment of payments)
    byCycle.set(
      payment.cycle,
      (byCycle.get(payment.cycle) ?? 0) + payment.amount,
    );
  const paidCycles = [...byCycle.values()].filter(
    (amount) => amount >= REWARD_NAIRA,
  ).length;
  const earned = completedCycles * REWARD_NAIRA;
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  let payable = Math.max(0, earned - paid);
  let unpaidCycles = 0;
  for (let cycle = 1; cycle <= completedCycles && payable > 0; cycle++) {
    const balance = REWARD_NAIRA - (byCycle.get(cycle) ?? 0);
    if (balance <= 0) continue;
    payable -= balance;
    unpaidCycles++;
  }
  return {
    verified,
    cycleProgress:
      verified % REFERRALS_PER_CYCLE || (verified ? REFERRALS_PER_CYCLE : 0),
    completedCycles,
    paidCycles,
    unpaidCycles,
    earned,
    paid,
    outstanding: earned - paid,
  };
}
