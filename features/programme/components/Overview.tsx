"use client";

import { BdOverview } from "@/features/bd-partners/BdIntelligence";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Users,
  Building2,
  Inbox,
  ShieldCheck,
  CalendarDays,
  ListChecks,
  CheckCircle2,
} from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { approvedSeats } from "@/lib/domain/queries";
import { spaceTotals, durationLabel } from "@/features/spaces/lib/space-data";
import { Avatar, Empty } from "@/components/ui";
import CurrentSundayCard from "./CurrentSundayCard";
import SundayLineup from "./SundayLineup";
import OverviewActivity from "./OverviewActivity";

const londonDate = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    ...options,
  }).format(new Date(value));

export default function Overview({ addFounder }: { addFounder: () => void }) {
  const { state: s, path, viewer } = useWorkspace();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const can = (permission: string) => viewer.permissions.includes(permission);
  const pending = s.applications
    .filter((a) => a.status === "Pending")
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  const bookings = s.bookings
    .filter((b) => b.status === "Pending")
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  const upcoming = s.sessions
    .filter((v) => v.status === "Scheduled" && Date.parse(v.startsAt) >= now)
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const seats = next ? approvedSeats(s, next.id) : 0;
  const occupancy =
    next && next.capacity > 0 ? Math.min(1, seats / next.capacity) : null;
  const incomplete = s.sessions.filter(
    (v) =>
      v.status !== "Cancelled" &&
      Date.parse(v.startsAt) < now &&
      !s.spaceData.some((r) => r.sessionId === v.id && r.submittedAt),
  );
  const totals = spaceTotals(s);
  const queue = [
    ...pending.slice(0, bookings.length ? 1 : 2).map((a) => ({
      id: a.id,
      name: a.companyName,
      person: a.founderName,
      kind: "Application",
      href: `${path("operations")}?tab=applications&review=${encodeURIComponent(a.id)}`,
    })),
    ...bookings.slice(0, 1).map((b) => {
      const a = s.applications.find((a) => a.id === b.applicationId);
      return {
        id: b.id,
        name: a?.companyName || "Project booking",
        person: a?.founderName || "Founder",
        kind: "Booking",
        href: `${path("operations")}?tab=bookings&session=${encodeURIComponent(b.sessionId)}`,
      };
    }),
  ];
  const metrics = [
    {
      label: "Founder records",
      value: s.founders.length,
      detail: "Programme directory",
      icon: Users,
      href: path("founders"),
    },
    {
      label: "Projects",
      value: s.companies.length,
      detail: "Company directory",
      icon: Building2,
      href: path("companies"),
    },
    {
      label: "Awaiting review",
      value: pending.length,
      detail: "Pending applications",
      icon: Inbox,
      href: `${path("operations")}?tab=applications&status=Pending`,
    },
  ];
  return (
    <>
      <div className="page-heading desk-heading">
        <div>
          <h1>Hello, {viewer.name.split(" ")[0]}.</h1>
          <p>Keep your founders, projects and weekly Spaces in view.</p>
        </div>
        <div className="heading-actions">
          {can("reports.read") && (
            <Link className="button" href={path("reports")}>
              View reports <ArrowUpRight size={15} />
            </Link>
          )}
          {can("directory.write") && (
            <button className="button primary" onClick={addFounder}>
              <Plus size={16} />
              Add founder
            </button>
          )}
        </div>
      </div>
      {viewer.roleId === "space-manager" && <SundayLineup now={now} />}
      <div className="desk-grid">
        {metrics.map(({ label, value, detail, icon: Icon, href }) => (
          <Link className="metric-card desk-metric" href={href} key={label}>
            <div>
              <span>{label}</span>
              <Icon size={20} />
            </div>
            <strong>{value}</strong>
            <small>{detail}</small>
          </Link>
        ))}
        <Link
          className="metric-card desk-metric desk-next"
          href={next ? path("spaces", next.id) : path("spaces")}
        >
          <div>
            <span>Next Space</span>
            <CalendarDays size={20} />
          </div>
          <strong>{next ? `${seats} / ${next.capacity}` : "—"}</strong>
          <small>
            {next
              ? `${londonDate(next.startsAt, { day: "numeric", month: "short" })} · 7 PM London`
              : "No upcoming Space"}
          </small>
        </Link>
        {can("reports.read") ? (
          <OverviewActivity />
        ) : (
          <section className="panel desk-activity">
            <h2>Programme activity</h2>
            <Empty title="Reports are restricted">
              Your account can access the programme directory.
            </Empty>
          </section>
        )}
        <section className="panel desk-capacity" aria-label="Space capacity">
          <h2>Space capacity</h2>
          <p>
            {next
              ? londonDate(next.startsAt, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })
              : "No upcoming Space"}
          </p>
          <strong>
            {next ? `${seats} of ${next.capacity} projects` : "Not scheduled"}
          </strong>
          <div
            className="desk-gauge"
            role="img"
            aria-label={
              occupancy === null
                ? "Capacity not configured"
                : `${seats} of ${next!.capacity} project seats approved`
            }
          >
            <svg viewBox="0 0 190 112" aria-hidden="true">
              <path
                d="M16 94 A79 79 0 0 1 174 94"
                fill="none"
                stroke="var(--desk-soft)"
                strokeWidth="20"
              />
              {occupancy !== null && (
                <path
                  d="M16 94 A79 79 0 0 1 174 94"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="20"
                  strokeDasharray={`${Math.PI * 79 * occupancy} ${Math.PI * 79}`}
                />
              )}
            </svg>
            <b>
              {occupancy === null ? "—" : `${Math.round(occupancy * 100)}%`}
            </b>
          </div>
          <small>Approved projects, separate from speakers</small>
        </section>
        <section className="panel desk-profile">
          <Avatar name={viewer.name} />
          <h2 title={viewer.name}>{viewer.name}</h2>
          <p>Programme {viewer.roleId.toLowerCase()}</p>
          <div className="desk-profile-stats">
            <div>
              <span>Spaces</span>
              <strong>{s.sessions.length}</strong>
            </div>
            <div>
              <span>Reports</span>
              <strong>{s.spaceData.filter((r) => r.submittedAt).length}</strong>
            </div>
            <div>
              <span>Countries</span>
              <strong>
                {new Set(s.founders.map((f) => f.country).filter(Boolean)).size}
              </strong>
            </div>
          </div>
        </section>
        <section className="panel desk-schedule">
          <div>
            <h2>Upcoming Spaces</h2>
            <p>
              Sundays, 7 PM London. Review applications before confirming
              seats.
            </p>
            <Link
              className="button primary"
              href={`${path("operations")}?tab=sessions`}
            >
              View programme <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="desk-tickets">
            {upcoming.slice(0, 3).map((session, i) => (
              <Link
                className="desk-ticket"
                href={path("spaces", session.id)}
                key={session.id}
                style={{ "--ticket-index": i } as React.CSSProperties}
              >
                <small>Founders Lab · Weekly Space</small>
                <strong>
                  {londonDate(session.startsAt, {
                    day: "numeric",
                    month: "short",
                  })}
                </strong>
                <span>
                  {approvedSeats(s, session.id)} / {session.capacity} projects
                </span>
              </Link>
            ))}
            {!upcoming.length && (
              <p className="desk-no-dates">No upcoming Spaces scheduled.</p>
            )}
          </div>
        </section>
        <section className="panel desk-queue" aria-label="Review queue">
          <div className="desk-card-heading">
            <h2>Review queue</h2>
            <Link
              className="icon-button"
              aria-label="Open all reviews"
              href={`${path("operations")}?tab=applications`}
            >
              <ArrowUpRight size={17} />
            </Link>
          </div>
          {queue.length ? (
            queue.map((item) => (
              <Link className="desk-queue-row" href={item.href} key={item.id}>
                <span>
                  <b title={item.name}>{item.name}</b>
                  <small>
                    {item.person} · {item.kind}
                  </small>
                </span>
                <ArrowRight size={15} />
              </Link>
            ))
          ) : (
            <div className="desk-clear">
              <CheckCircle2 size={22} />
              <p>You’re up to date. New requests will appear here.</p>
            </div>
          )}
          <span className="desk-queue-summary">
            {pending.length} applications · {bookings.length} bookings
          </span>
        </section>
        {can("team.manage") && (
          <section className="panel desk-access">
            <ShieldCheck size={28} />
            <h2>Owner access</h2>
            <p>Manage Space Manager access.</p>
            <Link className="button" href={path("owner-invitations")}>
              Manage invitations
            </Link>
          </section>
        )}
      </div>
      {(can("team.manage") || viewer.roleId === "space-manager") && (
        <BdOverview />
      )}
      <details className="panel desk-details">
        <summary>
          <ListChecks size={18} />
          Sunday roster & programme records{" "}
          <span>{incomplete.length} reports to complete</span>
        </summary>
        <div className="desk-details-body">
          <CurrentSundayCard />
          <section className="panel">
            <h2>Recorded programme results</h2>
            <p>
              Across recorded Spaces; attendance includes repeat participation.
            </p>
            <div className="studio-recorded-strip">
              {[
                ["Founder attendance", totals.founders],
                ["Team attendance", totals.people],
                ["Recorded listeners", totals.listeners],
                [
                  "Time hosted",
                  totals.durationMinutes === null
                    ? null
                    : durationLabel(totals.durationMinutes),
                ],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <strong className={value === null ? "not-recorded" : ""}>
                    {value ?? "Not recorded"}
                  </strong>
                </div>
              ))}
            </div>
            {incomplete.slice(0, 3).map((session) => (
              <Link
                className="desk-queue-row"
                href={path("spaces", session.id)}
                key={session.id}
              >
                <span>
                  <b>{session.title}</b>
                  <small>
                    Report needed ·{" "}
                    {londonDate(session.startsAt, {
                      day: "numeric",
                      month: "short",
                    })}
                  </small>
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
            <Link
              className="button"
              href={`${path("operations")}?tab=sessions`}
            >
              Enter Space data <ArrowUpRight size={15} />
            </Link>
          </section>
        </div>
      </details>
    </>
  );
}
