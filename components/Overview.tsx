"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Users,
  Building2,
  Globe2,
  Mic2,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { groupBy, growthData, dateTime } from "@/lib/selectors";
import { spaceTotals, durationLabel } from "@/lib/space-data";
import { SectionHeading, Empty, Status } from "./ui";
const Chart = dynamic(() => import("./Charts"), { ssr: false });
export default function Overview({ addFounder }: { addFounder: () => void }) {
  const { state: s, path, viewer } = useWorkspace();
  const pending = s.applications.filter((a) => a.status === "Pending");
  const upcoming = s.sessions
    .filter((v) => v.status === "Scheduled")
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  const totals = spaceTotals(s);
  const metrics = [
    {
      label: "Founders",
      value: s.founders.length,
      icon: Users,
      link: "founders",
    },
    {
      label: "Companies",
      value: s.companies.length,
      icon: Building2,
      link: "companies",
    },
    {
      label: "Countries",
      value: new Set(s.founders.map((f) => f.country)).size,
      icon: Globe2,
      link: "founders",
    },
    {
      label: "Completed Spaces",
      value: s.sessions.filter((v) => v.status === "Completed").length,
      icon: Mic2,
      link: "spaces",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <h1>Overview</h1>
        <div className="heading-actions">
          <Link className="button" href={path("reports")}>
            View report
            <ArrowUpRight size={15} />
          </Link>
          {viewer.permissions.includes("directory.write") && (
            <button className="button primary" onClick={addFounder}>
              <Plus size={16} />
              Add founder
            </button>
          )}
        </div>
      </div>
      <div className="metric-grid">
        {metrics.map(({ label, value, icon: Icon, link }) => (
          <Link className="metric-card" href={path(link)} key={label}>
            <div>
              {label}
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
          </Link>
        ))}
      </div>
      <div className="overview-charts">
        <section className="panel">
          <SectionHeading title="Founder growth" />
          <Chart label="Founder growth" type="area" data={growthData(s)} />
        </section>
        <section className="panel">
          <SectionHeading title="Founders by country" />
          <Chart
            label="Founders by country"
            data={groupBy(s.founders.map((f) => f.country))}
            type="donut"
            center={{ value: s.founders.length, label: "Founders" }}
          />
        </section>
      </div>
      <section className="panel">
        <SectionHeading
          title="Space totals"
          action={
            <Link className="text-link" href={path("space-data")}>
              Enter Space data
              <ArrowUpRight size={14} />
            </Link>
          }
        />
        <div className="metric-grid simple-space-totals">
          {[
            ["Founders attended", totals.founders],
            ["Team attendees", totals.people],
            ["Live listeners", totals.listeners],
            ["Total time", durationLabel(totals.durationMinutes)],
          ].map(([label, value]) => (
            <div className="metric-card" key={label}>
              <div>{label}</div>
              <strong>{value ?? "—"}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <SectionHeading
          title="Applications to review"
          action={
            <Link
              className="text-link"
              href={path("spaces") + "?tab=applications"}
            >
              View all
              <ArrowUpRight size={14} />
            </Link>
          }
        />
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Applications to review"
        >
          <table>
            <thead>
              <tr>
                <th>Founder</th>
                <th>Company</th>
                <th>Country</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pending.slice(0, 5).map((a) => (
                <tr key={a.id}>
                  <td>{a.founderName}</td>
                  <td>{a.companyName}</td>
                  <td>{a.country}</td>
                  <td>
                    <Status value={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!pending.length && <Empty>No applications awaiting review.</Empty>}
      </section>
      <section className="panel">
        <SectionHeading title="Upcoming Spaces" />
        {upcoming.slice(0, 4).map((session) => (
          <Link
            className="entity-row"
            href={path("spaces", session.id)}
            key={session.id}
          >
            <span>
              <b>{session.title}</b>
              <small>{dateTime(session.startsAt, session.timezone)}</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        ))}
        {!upcoming.length && <Empty>No upcoming Spaces.</Empty>}
      </section>
    </>
  );
}
