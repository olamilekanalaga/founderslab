"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import {
  programmeAnalytics,
  sessionSeries,
} from "@/features/reports/lib/programme-analytics";

const Chart = dynamic(
  () => import("@/features/reports/components/AnalyticsChart"),
  {
    ssr: false,
    loading: () => (
      <div className="desk-chart-loading" role="status">
        Loading chart…
      </div>
    ),
  },
);
export default function OverviewActivity() {
  const { state, path } = useWorkspace();
  const [metric, setMetric] = useState<"listeners" | "people" | "hours">(
    "listeners",
  );
  const [period, setPeriod] = useState("all");
  const data = programmeAnalytics(state);
  const recorded = data.sessions.filter((s) => s[metric] !== null);
  const sessions = period === "recent" ? recorded.slice(-3) : recorded;
  const series = sessionSeries(sessions, metric, false);
  const total = sessions.length
    ? sessions.reduce((sum, s) => sum + s[metric]!, 0)
    : null;
  const value =
    total === null
      ? "—"
      : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(
          total,
        ) + (metric === "hours" ? "h" : "");
  const label = {
    listeners: "Recorded listeners",
    people: "Team attendance",
    hours: "Hours hosted",
  }[metric];
  return (
    <section className="panel desk-activity" aria-label="Programme activity">
      <div className="desk-card-heading">
        <h2>Programme activity</h2>
        <select
          aria-label="Overview chart period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="all">All recorded Spaces</option>
          <option value="recent">Latest 3 recorded</option>
        </select>
      </div>
      <div className="desk-chart-summary">
        <div>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
        <label>
          <span>{sessions.length} recorded Spaces</span>
          <select
            aria-label="Overview chart metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
          >
            <option value="listeners">Listeners</option>
            <option value="people">Attendance</option>
            <option value="hours">Hosted time</option>
          </select>
        </label>
      </div>
      {series.length ? (
        <Chart
          data={series}
          label={label}
          unit={metric === "hours" ? "h" : ""}
          height={96}
        />
      ) : (
        <div className="desk-chart-empty">
          <BarChart3 size={24} />
          <p>
            No results recorded yet. Saved Space reports will build this chart.
          </p>
        </div>
      )}
      <Link
        className="desk-chart-link"
        href={`${path("reports")}?view=programme`}
      >
        Explore analytics <ArrowUpRight size={12} />
      </Link>
    </section>
  );
}
