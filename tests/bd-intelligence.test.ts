import assert from "node:assert/strict";
import test from "node:test";
import {
  bdIntelligence,
  type Partner,
} from "../features/bd-partners/intelligence";
import { rewardSummary } from "../features/bd-partners/rewards";

test("BD cycles accumulate across months and reporting reconciles verification and payments", () => {
  const partner: Partner = {
    id: "partner",
    name: "@partner",
    fullName: null,
    email: "partner@example.invalid",
    active: true,
    referralCode: "partner",
    createdAt: "2026-01-01",
    appearances: [
      "01-03",
      "01-10",
      "01-17",
      "02-07",
      "02-14",
      "02-21",
      "02-28",
      "03-07",
    ].map((date, index) => ({
      id: String(index),
      ordinal: index + 1,
      bookingId: String(index),
      sessionId: date,
      companyId: "company",
      verifiedAt: `2026-${date}`,
      reversedAt: null,
    })),
    payments: [
      {
        id: "payment",
        cycle: 1,
        amount: 5000,
        paidOn: "2026-02-28",
        reference: null,
      },
    ],
  };
  const allTime = bdIntelligence([partner], []).totals;
  assert.equal(allTime.verified, 8);
  assert.equal(allTime.cycles, 2);
  assert.equal(allTime.earned, 40_000);
  assert.equal(allTime.paid, 5_000);
  assert.equal(allTime.outstanding, 35_000);
  const february = bdIntelligence([partner], [], "2026-02").totals;
  assert.equal(february.verified, 4);
  assert.equal(february.cycles, 1);
  assert.equal(february.earned, 20_000);
  assert.equal(february.outstanding, 15_000);
  partner.appearances[7].reversedAt = "2026-03-08";
  assert.equal(bdIntelligence([partner], []).totals.earned, 20_000);
});

test("partial payouts and corrections preserve cash paid and prevent an artificial pending balance", () => {
  for (const [verified, earned, progress] of [
    [3, 0, 3],
    [4, 20_000, 4],
    [6, 20_000, 2],
    [8, 40_000, 4],
  ]) {
    const reward = rewardSummary(verified, []);
    assert.equal(reward.earned, earned);
    assert.equal(reward.cycleProgress, progress);
  }
  const payments = [
    { cycle: 1, amount: 5000 },
    { cycle: 1, amount: 15000 },
  ];
  assert.equal(rewardSummary(4, payments).paidCycles, 1);
  assert.equal(rewardSummary(3, payments).outstanding, -20_000);
  assert.equal(rewardSummary(3, payments).unpaidCycles, 0);
  assert.equal(
    rewardSummary(4, [{ cycle: 2, amount: 20_000 }]).unpaidCycles,
    0,
  );
});
