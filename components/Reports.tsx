"use client";
import { useState } from "react";
import { Download, FileText, BarChart3 } from "lucide-react";
import dynamic from "next/dynamic";
import { useWorkspace } from "./WorkspaceContext";
import { reportData, blankFilters, type Filters } from "@/lib/selectors";
import { reportRows, downloadCsv, downloadPdf } from "@/lib/export";
import { SectionHeading } from "./ui";
const Chart = dynamic(() => import("./Charts"), { ssr: false });
export default function Reports() {
  const { state: s, demo, setMessage } = useWorkspace(),
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
          <div className="eyebrow">RESEARCH YOU CAN STAND BEHIND</div>
          <h1>Reports & insights</h1>
          <p>Build a brief from the evidence, with the gaps kept in view.</p>
        </div>
        <div className="heading-actions">
          <button
            className="button"
            onClick={() => downloadCsv(reportRows(s, filters, demo))}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            disabled={exporting}
            className="button primary"
            onClick={async () => {
              setExporting(true);
              try {
                await downloadPdf(reportRows(s, filters, demo));
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
            Founder sample <BarChart3 size={17} />
          </div>
          <strong data-testid="report-founders">{r.founders.length}</strong>
          <small>Unique people matching these filters</small>
        </div>
        <div className="metric-card">
          <div>Company sample</div>
          <strong>{r.companies.length}</strong>
          <small>Unique associated companies</small>
        </div>
        <div className="metric-card">
          <div>Interview coverage</div>
          <strong>
            {r.founders.length
              ? Math.round((100 * r.covered) / r.founders.length)
              : 0}
            %
          </strong>
          <small>{r.covered} founders with complete research</small>
        </div>
        <div className="metric-card">
          <div>Explicit hiring signals</div>
          <strong>{r.hiring.length}</strong>
          <small>Only claims with supporting evidence</small>
        </div>
      </div>
      <div className="two-grid">
        <section className="panel">
          <SectionHeading
            title="Country distribution"
            detail={`Base: ${r.founders.length} founders`}
          />
          <Chart label="Report countries" data={r.countries} />
        </section>
        <section className="panel">
          <SectionHeading
            title="Sector analysis"
            detail={`Base: ${r.companies.length} companies`}
          />
          <Chart label="Report sectors" data={r.sectors} />
        </section>
        <section className="panel">
          <SectionHeading title="Product maturity" />
          <Chart label="Report product stages" data={r.stages} />
        </section>
        <section className="panel">
          <SectionHeading title="Common business challenges" />
          <Chart label="Report needs" data={r.businessNeeds} />
        </section>
      </div>
      <section className="panel">
        <SectionHeading
          title="What this sample tells us"
          detail="Counts are derived from stored records; missing fields are not treated as negative responses."
        />
        <div className="report-summary-grid">
          {[
            ["Team sizes", r.teams],
            ["Distribution channels", r.distribution],
            [
              "Data & analytics needs",
              r.businessNeeds.filter((n) => n.name === "Data analytics"),
            ],
            ["Opportunity stages", r.pipeline],
          ].map(([title, rows]) => (
            <div key={String(title)}>
              <h3>{String(title)}</h3>
              {(rows as { name: string; value: number }[]).map((row) => (
                <div className="report-stat" key={row.name}>
                  <span>{row.name}</span>
                  <b>{row.value}</b>
                </div>
              ))}
              {!(rows as unknown[]).length && (
                <p className="muted">No responses recorded.</p>
              )}
            </div>
          ))}
        </div>
        <div className="coverage-metrics">
          <span>
            <b>{r.integrations.length}</b> Potential integrations
          </span>
          <span>
            <b>{r.partnerships.length}</b> Partnership hypotheses
          </span>
        </div>
      </section>
      <section className="panel padded">
        <h2>Coverage, sources & limitations</h2>
        <p>
          Source:{" "}
          {demo || s.fictional
            ? "fictional applications and manually written demo interviews"
            : "stored founder applications and manually entered interview records"}
          . Founder counts refer to unique people; company distributions refer
          to unique companies. Multi-label fields can sum to more than the
          sample size.
        </p>
        <div className="missing-grid">
          {Object.entries(r.missing).map(([key, value]) => (
            <div key={key}>
              <b>{value}</b>
              <small>
                {
                  (
                    {
                      companyProfiles: "Founders without a company profile",
                      customerSegment: "Missing customer segment",
                      businessModel: "Missing business model",
                      distribution: "Missing distribution channels",
                      completedResearch: "Without complete interview research",
                    } as Record<string, string>
                  )[key]
                }
              </small>
            </div>
          ))}
        </div>
        <p className="limitations">
          This is a convenience sample of programme participants, with an
          initial Nigerian and African focus. It is not representative of the
          entire Web3 industry. Self-reported claims and unverified relationship
          hypotheses need independent validation. Blank responses, uneven
          interview coverage and different company stages limit comparisons.
        </p>
      </section>
    </>
  );
}
