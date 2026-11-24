"use client";
import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  BarChart3,
  Users,
  Clock3,
  CalendarDays,
  Download,
} from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Empty } from "@/components/ui";
import {
  programmeAnalytics,
  sessionSeries,
  founderSeries,
  presetRange,
  rangeError,
  comparison,
  type AnalyticsMetric,
  type AnalyticsRange,
} from "@/features/reports/lib/programme-analytics";
import { downloadCsv } from "@/features/reports/lib/export";

const Chart = dynamic(() => import("./AnalyticsChart"), {
  ssr: false,
  loading: () => (
    <div
      className="chart-skeleton"
      role="status"
      aria-label="Loading analytics chart"
    />
  ),
});
const metricLabels: Record<AnalyticsMetric, string> = {
  listeners: "Recorded listeners",
  people: "Team attendance",
  founders: "Founder attendance",
  hours: "Hours hosted",
  records: "Founder records added",
  occupancy: "Project occupancy",
};
const format = (value: number | null, unit = "") =>
  value === null
    ? "Not recorded"
    : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)}${unit}`;

function Breakdown({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  const total = data.reduce((n, row) => n + row.value, 0);
  return (
    <div className="studio-breakdown">
      <h3>{title}</h3>
      {data.length ? (
        <div>
          {data.map((row) => (
            <div className="studio-breakdown-row" key={row.name}>
              <div>
                <span>{row.name}</span>
                <b>{row.value}</b>
              </div>
              <meter
                min={0}
                max={total}
                value={row.value}
                aria-label={`${row.name}: ${row.value} of ${total}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No records in this period">
          Your recorded programme data will appear here.
        </Empty>
      )}
    </div>
  );
}
export default function ProgrammeAnalytics({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { state, path } = useWorkspace();
  const [metric, setMetric] = useState<AnalyticsMetric>("listeners");
  const [preset, setPreset] = useState("all");
  const [range, setRange] = useState<AnalyticsRange>({ from: "", to: "" });
  const [cumulative, setCumulative] = useState(true);
  const [breakdown, setBreakdown] = useState("countries");
  const error = rangeError(range);
  const effectiveRange = error ? { from: "", to: "" } : range;
  const data = programmeAnalytics(state, effectiveRange);
  const unit = metric === "hours" ? "h" : metric === "occupancy" ? "%" : "";
  const series =
    metric === "records"
      ? founderSeries(data.founders, effectiveRange, cumulative)
      : sessionSeries(data.sessions, metric, cumulative);
  const known = series.filter((row) => row.value !== null);
  const total =
    metric === "records"
      ? data.founders.length
      : metric === "occupancy"
        ? data.occupancy
        : data.totals[metric];
  const coverage =
    metric === "records"
      ? null
      : metric === "occupancy"
        ? data.sessions.filter((s) => s.capacity > 0).length
        : data.coverage[metric];
  let change: ReturnType<typeof comparison> = null;
  if (!error && range.from && range.to) {
    const days =
      Math.floor((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000) +
      1;
    const previousTo = new Date(Date.parse(range.from) - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const previousFrom = new Date(Date.parse(range.from) - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const previous = programmeAnalytics(state, {
      from: previousFrom,
      to: previousTo,
    });
    if (metric === "records")
      change = comparison(total, previous.founders.length);
    else if (
      metric === "occupancy" &&
      coverage === data.sessions.length &&
      previous.sessions.every((s) => s.capacity > 0)
    )
      change = comparison(total, previous.occupancy);
    else if (
      metric !== "occupancy" &&
      coverage === data.sessions.length &&
      previous.coverage[metric] === previous.sessions.length
    )
      change = comparison(total, previous.totals[metric]);
  }
  const updatePreset = (value: string) => {
    setPreset(value);
    if (value === "all") setRange({ from: "", to: "" });
    else if (value !== "custom")
      setRange(presetRange(Number(value), new Date()));
  };
  const scope =
    metric === "records"
      ? "Founder added dates · UTC"
      : "Space dates · Europe/London";
  const chartLabel =
    metric === "occupancy"
      ? "Approved project seats / configured capacity"
      : `${cumulative ? "Cumulative" : "Per-date"} ${metricLabels[metric].toLowerCase()}`;
  const selection =
    breakdown === "countries"
      ? { title: "Founder countries", rows: data.countries }
      : breakdown === "sectors"
        ? { title: "Project sectors", rows: data.sectors }
        : { title: "Project stages", rows: data.stages };
  const csvRows = [
    ["Metric", "Date", "Value", "Scope"],
    ...series.map((row) => [
      metricLabels[metric],
      row.name,
      row.value === null ? "Not recorded" : String(row.value),
      scope,
    ]),
  ];
  return (
    <section
      className={`studio-analytics ${compact ? "compact" : ""}`}
      aria-label="Programme analytics"
    >
      <div className="studio-analytics-heading">
        <div>
          <span className="page-eyebrow">Programme insights</span>
          <h2>
            {compact
              ? "A closer look at your programme"
              : "Programme analytics"}
          </h2>
          <p>Recorded activity, with a clear view of what’s missing.</p>
        </div>
        {compact ? (
          <Link
            className="text-link"
            href={`${path("reports")}?view=programme`}
          >
            Explore analytics <ArrowUpRight size={14} />
          </Link>
        ) : (
          <button
            className="button"
            disabled={Boolean(error) || !known.length}
            onClick={() => downloadCsv(csvRows)}
          >
            <Download size={15} />
            Export this chart
          </button>
        )}
      </div>
      <div className="studio-analytics-controls">
        <label>
          Metric
          <select
            aria-label="Growth metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as AnalyticsMetric)}
          >
            {Object.entries(metricLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Period
          <select
            aria-label="Analytics period"
            value={preset}
            onChange={(e) => updatePreset(e.target.value)}
          >
            <option value="all">All time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom dates</option>
          </select>
        </label>
        {preset === "custom" && (
          <>
            <label>
              From
              <input
                aria-label="Analytics from date"
                type="date"
                value={range.from}
                onChange={(e) =>
                  setRange((r) => ({ ...r, from: e.target.value }))
                }
              />
            </label>
            <label>
              Until
              <input
                aria-label="Analytics until date"
                type="date"
                value={range.to}
                onChange={(e) =>
                  setRange((r) => ({ ...r, to: e.target.value }))
                }
              />
            </label>
          </>
        )}
        {metric !== "occupancy" && (
          <div className="studio-segmented" aria-label="Chart calculation">
            <button
              type="button"
              aria-pressed={cumulative}
              onClick={() => setCumulative(true)}
            >
              Cumulative
            </button>
            <button
              type="button"
              aria-pressed={!cumulative}
              onClick={() => setCumulative(false)}
            >
              Per date
            </button>
          </div>
        )}
      </div>
      {error ? (
        <p className="studio-range-error" role="alert">
          {error}
        </p>
      ) : (
        <>
          {!compact && (
            <div className="metric-grid studio-analytics-totals">
              {[
                {
                  label: "Founder records added",
                  value: data.founders.length,
                  icon: Users,
                  detail: "Selected added-date period",
                },
                {
                  label: "Recorded listeners",
                  value: data.totals.listeners,
                  icon: BarChart3,
                  detail: `${data.coverage.listeners}/${data.sessions.length} Spaces recorded`,
                },
                {
                  label: "Hours hosted",
                  value: data.totals.hours,
                  icon: Clock3,
                  detail: `${data.coverage.hours}/${data.sessions.length} Spaces recorded`,
                },
                {
                  label: "Project occupancy",
                  value: data.occupancy,
                  icon: CalendarDays,
                  detail: `${data.seats}/${data.capacity} approved project seats`,
                },
              ].map(({ label, value, icon: Icon, detail }) => (
                <div className="metric-card" key={label}>
                  <div>
                    {label}
                    <Icon size={17} />
                  </div>
                  <strong className={value === null ? "not-recorded" : ""}>
                    {format(value, label === "Project occupancy" ? "%" : "")}
                  </strong>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
          )}
          <div className="studio-analytics-grid">
            <div className="panel studio-analytics-main">
              <div className="studio-chart-heading">
                <div>
                  <span>{metricLabels[metric]}</span>
                  <strong className={total === null ? "not-recorded" : ""}>
                    {format(total, unit)}
                  </strong>
                </div>
                <div className="studio-chart-scope">
                  <span>{scope}</span>
                  {coverage !== null && (
                    <span>
                      {coverage}/{data.sessions.length} Spaces{" "}
                      {metric === "occupancy" ? "with capacity" : "recorded"}
                    </span>
                  )}
                  {change && (
                    <span>
                      {change.absolute > 0 ? "+" : ""}
                      {format(change.absolute, unit)}
                      {change.percent !== null && metric !== "occupancy"
                        ? ` (${format(change.percent, "%")})`
                        : ""}{" "}
                      vs previous period
                    </span>
                  )}
                </div>
              </div>
              {known.length ? (
                <Chart
                  data={series}
                  label={chartLabel}
                  unit={unit}
                  bars={metric === "occupancy" || !cumulative}
                />
              ) : (
                <div className="studio-chart-empty">
                  <BarChart3 aria-hidden="true" />
                  <h3>
                    No {metricLabels[metric].toLowerCase()} in this period
                  </h3>
                  <p>
                    {metric === "records"
                      ? "New founder records will build this chart."
                      : "Save Space results to see recorded activity here."}
                  </p>
                  <Link
                    className="text-link"
                    href={path(metric === "records" ? "founders" : "spaces")}
                  >
                    Open {metric === "records" ? "founder records" : "Spaces"}
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
              <p className="studio-chart-caption">
                {metric === "occupancy"
                  ? "Project seats count each approved project once, separately from speaker count."
                  : metric === "records"
                    ? "Cumulative values count records added within the selected period."
                    : "Missing numbers remain unrecorded. Attendance and listener counts can include repeat participation."}
              </p>
            </div>
            <div className="panel studio-analytics-breakdown">
              <div className="studio-breakdown-header">
                <span>Directory breakdown</span>
                <select
                  aria-label="Breakdown group"
                  value={breakdown}
                  onChange={(e) => setBreakdown(e.target.value)}
                >
                  <option value="countries">Countries</option>
                  <option value="sectors">Sectors</option>
                  <option value="stages">Stages</option>
                </select>
              </div>
              <Breakdown
                title={selection.title}
                data={compact ? selection.rows.slice(0, 5) : selection.rows}
              />
              <p className="studio-chart-caption">
                {breakdown === "countries" ? "Founder" : "Project"} added dates
                · UTC{compact && selection.rows.length > 5 ? " · Top 5" : ""}
              </p>
            </div>
          </div>
          {!compact && (
            <>
              <div className="studio-pipeline-grid">
                <section className="panel">
                  <Breakdown
                    title="Application status"
                    data={data.applicationStatuses}
                  />
                  <p className="studio-chart-caption">
                    Current status of submissions in this period · submitted
                    dates UTC.
                  </p>
                </section>
                <section className="panel">
                  <Breakdown
                    title="Booking status"
                    data={data.bookingStatuses}
                  />
                  <p className="studio-chart-caption">
                    Current requests for the selected Spaces · application
                    approval is separate.
                  </p>
                </section>
              </div>
              <details className="panel studio-chart-data">
                <summary>View chart data</summary>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label={`${metricLabels[metric]} data`}
                >
                  <table>
                    <caption className="sr-only">{chartLabel}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">{chartLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.map((row) => (
                        <tr key={row.name}>
                          <td>{row.name}</td>
                          <td>{format(row.value, unit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!series.length && (
                    <p className="padded">No values recorded in this period.</p>
                  )}
                </div>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
