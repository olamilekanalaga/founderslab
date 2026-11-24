"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { bdIntelligence, naira, type Partner } from "./intelligence";

function Metrics({ data }: { data: ReturnType<typeof bdIntelligence> }) {
  const { totals, acquired } = data;
  return (
    <div className="metric-grid bd-performance-metrics">
      {[
        ["Registered BD partners", totals.registered],
        ["Active BD partners", totals.active],
        ["Referred applications", totals.applications],
        ["Verified appearances", totals.verified],
        ["Completed cycles", totals.cycles],
        ["Commission earned", naira.format(totals.earned)],
        ["Commission paid", naira.format(totals.paid)],
        ["Outstanding commission", naira.format(totals.outstanding)],
        ["Partners paid", totals.recipients],
        ["Founders acquired", acquired],
      ].map(([label, value]) => (
        <div className="metric-card" key={label}>
          <div>{label}</div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function BdOverview() {
  return (
    <section className="panel padded">
      <h2>BD performance</h2>
      <Link className="button" href="/operations?tab=performance">
        Open BD Performance
      </Link>
    </section>
  );
}

export default function BdIntelligence({ partners }: { partners: Partner[] }) {
  const { state } = useWorkspace();
  const [month, setMonth] = useState("");
  const [partner, setPartner] = useState("");
  const [rankBy, setRankBy] = useState<"verified" | "earned" | "paid">(
    "verified",
  );
  const data = bdIntelligence(
    partners.filter((row) => !partner || row.id === partner),
    state.applications,
    month,
  );
  const ranked = data.rows.toSorted(
    (a, b) =>
      b[rankBy] - a[rankBy] || a.partner.name.localeCompare(b.partner.name),
  );
  return (
    <section className="bd-performance">
      <div className="panel padded bd-performance-filters">
        <label>
          Month (optional)
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
        <label>
          BD partner
          <select
            value={partner}
            onChange={(event) => setPartner(event.target.value)}
          >
            <option value="">All partners</option>
            {partners.map((row) => (
              <option key={row.id} value={row.id}>
                {row.fullName || row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rank by
          <select
            value={rankBy}
            onChange={(event) => setRankBy(event.target.value as typeof rankBy)}
          >
            <option value="verified">Verified appearances</option>
            <option value="earned">Commission earned</option>
            <option value="paid">Commission paid</option>
          </select>
        </label>
      </div>
      {month && (
        <p>
          Applications, verifications, cycle completions and payments use their
          recorded dates. Outstanding is the net for this period.
        </p>
      )}
      <Metrics data={data} />
      <section className="panel padded">
        <h2>Leaderboard</h2>
        <div
          className="table-wrap"
          role="region"
          tabIndex={0}
          aria-label="BD performance leaderboard"
        >
          <table>
            <thead>
              <tr>
                {[
                  "Rank",
                  "BD partner",
                  "Applications",
                  "Verified",
                  "Cycles",
                  "Earned",
                  "Paid",
                  "Outstanding",
                ].map((head) => (
                  <th scope="col" key={head}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => (
                <tr key={row.partner.id}>
                  <td>{index + 1}</td>
                  <th scope="row">
                    <Link href={`/operations?tab=bd&partner=${row.partner.id}`}>
                      {[row.partner.fullName, row.partner.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </Link>
                  </th>
                  <td>{row.applications}</td>
                  <td>{row.verified}</td>
                  <td>{row.cycles}</td>
                  <td>{naira.format(row.earned)}</td>
                  <td>{naira.format(row.paid)}</td>
                  <td>{naira.format(row.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ranked.length && <p>No BD partners match these filters.</p>}
      </section>
    </section>
  );
}
