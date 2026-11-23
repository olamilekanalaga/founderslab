"use client";
import { useState } from "react";
import { Download, FileText, BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import {
  reportData,
  blankFilters,
  type Filters,
} from "@/features/reports/lib/selectors";

import {
  reportRows,
  downloadCsv,
  downloadPdf,
} from "@/features/reports/lib/export";
import { SectionHeading } from "@/components/ui";
const Chart = dynamic(() => import("@/components/ui/Charts"), { ssr: false });
export default function Reports() {
  const { state: s, setMessage } = useWorkspace(),
    [filters, setFilters] = useState<Filters>(blankFilters),
    [exporting, setExporting] = useState(false);
  const r = reportData(s, filters),
    change = (key: keyof Filters, value: string) =>
      setFilters((v) => ({ ...v, [key]: value }));
  const unique = (a: string[]) => Array.from(new Set(a)).sort();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Reports</h1>
        </div>
        <div className="heading-actions">
          <button
            className="button"
            onClick={() => downloadCsv(reportRows(s, filters, false))}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            disabled={exporting}
            className="button primary"
            onClick={async () => {
              setExporting(true);
              try {
                await downloadPdf(reportRows(s, filters, false));
              } catch {
                setMessage("PDF export failed. CSV is available.");
              } finally {
                setExporting(false);
              }
            }}
          >
            <FileText size={15} />
            {exporting ? "Generating…" : "Export PDF"}
          </button>
        </div>
      </div>
      <div className="panel report-filters">
        <label>
          Country
          <select
            aria-label="Country"
            value={filters.country}
            onChange={(e) => change("country", e.target.value)}
          >
            <option value="">All countries</option>
            {unique(s.founders.map((f) => f.country)).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Sector
          <select
            aria-label="Sector"
            value={filters.sector}
            onChange={(e) => change("sector", e.target.value)}
          >
            <option value="">All sectors</option>
            {unique(s.companies.map((c) => c.sector)).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Stage
          <select
            aria-label="Stage"
            value={filters.stage}
            onChange={(e) => change("stage", e.target.value)}
          >
            <option value="">All stages</option>
            {unique(s.companies.map((c) => c.stage)).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Cohort
          <select
            aria-label="Cohort"
            value={filters.cohort}
            onChange={(e) => change("cohort", e.target.value)}
          >
            <option value="">All cohorts</option>
            {s.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Founder added from
          <input
            type="date"
            aria-label="From date"
            value={filters.from}
            onChange={(e) => change("from", e.target.value)}
          />
        </label>
        <label>
          Founder added until
          <input
            type="date"
            aria-label="To date"
            value={filters.to}
            onChange={(e) => change("to", e.target.value)}
          />
        </label>
        <button className="button" onClick={() => setFilters(blankFilters)}>
          Clear filters
        </button>
      </div>
      <div className="metric-grid">
        <div className="metric-card">
          <div>
            Founders <BarChart3 size={17} />
          </div>
          <strong data-testid="report-founders">{r.founders.length}</strong>
        </div>
        <div className="metric-card">
          <div>Companies</div>
          <strong>{r.companies.length}</strong>
        </div>
        <div className="metric-card">
          <div>Countries</div>
          <strong>{r.countries.length}</strong>
        </div>
      </div>
      <div className="overview-charts">
        <section className="panel">
          <SectionHeading title="Country distribution" />
          <Chart label="Report countries" data={r.countries} />
        </section>
        <section className="panel">
          <SectionHeading title="Team sizes" />
          <Chart label="Report team sizes" data={r.teams} />
        </section>
        <section className="panel">
          <SectionHeading title="Projects by chain" />
          <Chart label="Projects by chain" data={r.chains} />
        </section>
      </div>
      <section className="panel">
        <SectionHeading title="Founder records" />
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Founder report records"
        >
          <table>
            <thead>
              <tr>
                <th>Founder</th>
                <th>Company</th>
                <th>Country</th>
                <th>Short description</th>
              </tr>
            </thead>
            <tbody>
              {r.founders.map((f) => {
                const companies = s.memberships
                  .filter((m) => m.founderId === f.id)
                  .map((m) => s.companies.find((c) => c.id === m.companyId))
                  .filter((c) => !!c);
                return (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td>{companies.map((c) => c.name).join(", ") || "—"}</td>
                    <td>{f.country}</td>
                    <td>
                      {companies
                        .map((c) => c.description)
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!r.founders.length && (
          <p className="padded">No founders match these filters.</p>
        )}
      </section>
    </>
  );
}
