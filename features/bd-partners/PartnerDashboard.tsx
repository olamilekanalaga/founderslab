"use client";

import { useCallback, useEffect, useState } from "react";
import ReferralLink from "./ReferralLink";
import { referralStatus } from "./referral-status";
import { naira } from "./intelligence";
import { REFERRALS_PER_CYCLE, rewardSummary } from "./rewards";

type Dashboard = {
  referralCode: string;
  applications: {
    id: string;
    founderName: string;
    companyName: string;
    status: string;
    ineligible: boolean;
    bookings: { id: string; status: string; attended: boolean }[];
  }[];
  appearances: { bookingId: string }[];
  payments: { id: string; cycle: number; amount: number; paidOn: string }[];
};

export default function PartnerDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [invite, setInvite] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/bd-access", { cache: "no-store" });
    if (response.ok) setDashboard(await response.json());
    else if (response.status === 401) setDashboard(undefined);
    else throw new Error("Could not load your BD dashboard.");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const invite = new URLSearchParams(location.hash.slice(1)).get("token");
      if (invite) {
        history.replaceState(null, "", location.pathname);
        setInvite(invite);
        setLoading(false);
      } else {
        void load()
          .catch(() => setMessage("Could not load your BD dashboard."))
          .finally(() => setLoading(false));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function action(command: "verify" | "logout") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/bd-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: command,
          ...(command === "verify" && { token: invite }),
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setInvite("");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not complete the request.",
      );
    } finally {
      setBusy(false);
    }
  }

  const reward =
    dashboard &&
    rewardSummary(dashboard.appearances.length, dashboard.payments);
  const verified = new Set(
    dashboard?.appearances.map((appearance) => appearance.bookingId),
  );
  return (
    <main className="manager-page" id="main-content">
      <h1>Your BD dashboard</h1>
      {message && <p role="alert">{message}</p>}
      {loading ? (
        <p role="status">Loading…</p>
      ) : invite ? (
        <section className="panel padded">
          <h2>Open your partner dashboard</h2>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => void action("verify")}
          >
            Continue securely
          </button>
        </section>
      ) : dashboard && reward ? (
        <>
          <div className="row-between">
            <ReferralLink code={dashboard.referralCode} />
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void action("logout")}
            >
              Sign out
            </button>
          </div>
          <section className="panel padded">
            <h2>Referral progress</h2>
            <p>
              Only verified appearances in completed, approved Spaces earn
              commission. Four verified appearances earn ₦20,000.
            </p>
            <dl className="facts">
              {[
                ["Total referred founders", dashboard.applications.length],
                [
                  "Pending founder applications",
                  dashboard.applications.filter(
                    (app) => app.status === "Pending",
                  ).length,
                ],
                ["Verified appearances", reward.verified],
                [
                  "Current cycle",
                  `${reward.cycleProgress}/${REFERRALS_PER_CYCLE}`,
                ],
                ["Completed cycles", reward.completedCycles],
                ["Commission earned", naira.format(reward.earned)],
                ["Paid", naira.format(reward.paid)],
                ["Outstanding", naira.format(reward.outstanding)],
              ].map(([label, amount]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{amount}</dd>
                </div>
              ))}
            </dl>
            <p>{reward.unpaidCycles} completed cycles pending payment.</p>
          </section>
          <section className="panel padded">
            <h2>Referral history</h2>
            {dashboard.applications.length ? (
              <ul>
                {dashboard.applications.map((app) => (
                  <li key={app.id}>
                    {app.founderName} · {app.companyName} ·{" "}
                    {referralStatus(app, app.bookings, verified)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No referred founders yet.</p>
            )}
            <h2>Payment history</h2>
            {dashboard.payments.length ? (
              <ul>
                {dashboard.payments.map((payment) => (
                  <li key={payment.id}>
                    Cycle {payment.cycle} · {payment.paidOn} · Payment completed
                    · {naira.format(payment.amount)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No payments recorded.</p>
            )}
          </section>
        </>
      ) : (
        <p>Open your private invitation from the programme owner to sign in.</p>
      )}
    </main>
  );
}
