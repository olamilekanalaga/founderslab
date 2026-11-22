"use client";
import { useState } from "react";
import { Award } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { londonDay } from "@/lib/saturday-schedule";
export default function Campaigns() {
  const { state: s, viewer, mutate, busy } = useWorkspace();
  const [period, setPeriod] = useState(() => londonDay(new Date()).slice(0, 7)),
    [chosen, setChosen] = useState("");
  const ids = new Set(
    s.participants
      .filter(
        (p) =>
          p.attendance !== "Cancelled" &&
          s.sessions.some(
            (session) =>
              session.id === p.sessionId &&
              londonDay(session.startsAt).slice(0, 7) === period,
          ),
      )
      .map((p) => p.founderId),
  );
  const founders = s.founders
    .filter((f) => ids.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const campaign = s.campaigns.find((c) => c.period === period),
    award = s.awards.find((a) => a.campaignId === campaign?.id),
    winner = s.founders.find((f) => f.id === award?.founderId);
  const value = chosen || winner?.id || "";
  return (
    <>
      <div className="page-heading">
        <h1>Monthly winner</h1>
      </div>
      <section className="panel padded">
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            await mutate("/api/monthly-winner", { period, founderId: value });
          }}
        >
          <label>
            Month
            <input
              type="month"
              required
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setChosen("");
              }}
            />
          </label>
          <label>
            Winner
            <select
              required
              aria-label="Winner"
              value={value}
              onChange={(e) => setChosen(e.target.value)}
            >
              <option value="">Choose a founder</option>
              {founders.map((f) => {
                const company = s.companies.find((c) =>
                  s.memberships.some(
                    (m) => m.founderId === f.id && m.companyId === c.id,
                  ),
                );
                return (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {company ? ` · ${company.name}` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <button
            className="button primary"
            disabled={
              busy || !value || !viewer.permissions.includes("campaign.write")
            }
          >
            Save winner
          </button>
        </form>
        {!founders.length && (
          <p className="muted">
            No founder participants recorded for this month.
          </p>
        )}
      </section>
      {winner && (
        <section className="panel padded">
          <div className="award-winner">
            <Award size={30} />
            <div>
              <h2>{winner.name}</h2>
              <p>
                {campaign?.awardAmount || "1 SOL"} · {period}
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
