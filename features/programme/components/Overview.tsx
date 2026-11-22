"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Users,
  Building2,
  Mic2,
  Plus,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Inbox,
  CheckCircle2,
  Clock3,
  ListChecks,
} from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { groupBy, growthData } from "@/features/reports/lib/selectors";
import { approvedSeats } from "@/lib/domain";
import { spaceTotals, durationLabel } from "@/features/spaces/lib/space-data";
import { SectionHeading, Empty, Status, Avatar } from "@/components/ui";
const Chart = dynamic(() => import("@/components/ui/Charts"), {
  ssr: false,
  loading: () => (
    <div className="chart-skeleton" role="status" aria-label="Loading chart" />
  ),
});
export default function Overview({ addFounder }: { addFounder: () => void }) {
  const { state: s, path, viewer } = useWorkspace();
  const pending = s.applications.filter((a) => a.status === "Pending");
  const bookings = s.bookings.filter((b) => b.status === "Pending");
  const now = new Date();
  const upcoming = s.sessions
    .filter(
      (v) =>
        v.status === "Scheduled" && Date.parse(v.startsAt) >= now.getTime(),
    )
    .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  const needsResults = s.sessions.filter(
    (v) =>
      v.status !== "Cancelled" &&
      Date.parse(v.startsAt) < now.getTime() &&
      !s.spaceData.some((r) => r.sessionId === v.id && r.submittedAt),
  );
  const next = upcoming[0];
  const seats = next ? approvedSeats(s, next.id) : 0;
  const totals = spaceTotals(s);
  const london = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
      timeZoneName: "short",
    }).format(new Date(value));
  const metrics = [
    {
      label: "Applications to review",
      value: pending.length,
      detail: "Awaiting a decision",
      icon: Inbox,
      link: "spaces?tab=applications",
    },
    {
      label: "Pending bookings",
      value: bookings.length,
      detail: "Seats reserved after approval",
      icon: CalendarDays,
      link: "spaces?tab=bookings",
    },
    {
      label: "Founder records",
      value: s.founders.length,
      detail: `${s.companies.length} companies in the directory`,
      icon: Users,
      link: "founders",
    },
    {
      label: "Results to complete",
      value: needsResults.length,
      detail: "Past Spaces awaiting attendance",
      icon: ListChecks,
      link: "spaces",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Programme overview</span>
          <h1>A clear view of what’s next.</h1>
          <p>
            Review your founders, prepare the next Space and keep the programme
            moving.
          </p>
        </div>
        <div className="heading-actions">
          {viewer.permissions.includes("directory.write") && (
            <button className="button primary" onClick={addFounder}>
              <Plus size={17} />
              Add founder
            </button>
          )}
        </div>
      </div>
      <div className="admin-overview-lead">
        <section className="next-space panel">
          <div className="next-space-heading">
            <span className="page-eyebrow">
              <CalendarDays size={16} />
              Next programme Space
            </span>
            {next && <Status value={next.status} />}
          </div>
          {next ? (
            <>
              <div className="next-space-body">
                <div className="next-space-date">
                  <strong>
                    {new Intl.DateTimeFormat("en", {
                      day: "2-digit",
                      timeZone: "Europe/London",
                    }).format(new Date(next.startsAt))}
                  </strong>
                  <span>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      timeZone: "Europe/London",
                    }).format(new Date(next.startsAt))}
                  </span>
                </div>
                <div>
                  <h2>{next.title}</h2>
                  <p>
                    <Clock3 size={15} />
                    {london(next.startsAt)}
                  </p>
                  <small>Programme time · Europe/London</small>
                </div>
              </div>
              <div className="seat-capacity">
                <div>
                  <span>Approved project seats</span>
                  <b>
                    {seats}
                    <span> / {next.capacity}</span>
                  </b>
                </div>
                <div
                  className="seat-marks"
                  role="img"
                  aria-label={`${seats} of ${next.capacity} project seats approved`}
                >
                  {Array.from(
                    { length: Math.min(next.capacity, 50) },
                    (_, i) => (
                      <span className={i < seats ? "filled" : ""} key={i} />
                    ),
                  )}
                </div>
                <p>
                  {Math.max(0, next.capacity - seats)} project seats available.
                  Pending requests do not reserve a seat.
                </p>
              </div>
              <div className="next-space-actions">
                <Link className="button primary" href={path("spaces", next.id)}>
                  Manage this Space
                  <ArrowRight size={17} />
                </Link>
                <Link
                  className="text-link"
                  href={`${path("spaces")}?tab=bookings`}
                >
                  Review bookings
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </>
          ) : (
            <Empty
              title="Your next Space starts here"
              action={
                <Link className="button" href={path("spaces")}>
                  Open programme schedule
                  <ArrowRight size={16} />
                </Link>
              }
            >
              Create or review upcoming sessions in Founder Spaces.
            </Empty>
          )}
        </section>
        <section className="panel review-queue">
          <SectionHeading
            title="Review queue"
            action={
              <span className="queue-count">
                {pending.length + bookings.length}
              </span>
            }
          />
          {pending.length || bookings.length ? (
            <>
              <div className="queue-links">
                <Link href={`${path("spaces")}?tab=applications`}>
                  <Inbox size={21} />
                  <div>
                    <b>{pending.length} pending applications</b>
                    <small>Review founder and project details</small>
                  </div>
                  <ArrowRight size={18} />
                </Link>
                <Link href={`${path("spaces")}?tab=bookings`}>
                  <CalendarDays size={21} />
                  <div>
                    <b>{bookings.length} pending bookings</b>
                    <small>Confirm project seats for each Space</small>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              </div>
              <p className="queue-note">
                Application approval and seat approval are separate steps.
              </p>
            </>
          ) : (
            <div className="queue-clear">
              <span>
                <CheckCircle2 size={25} />
              </span>
              <h3>You’re up to date.</h3>
              <p>
                New applications and booking requests will appear here for
                review.
              </p>
              <Link
                className="text-link"
                href={`${path("spaces")}?tab=applications`}
              >
                Open applications
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
      </div>
      <div className="metric-grid overview-metrics">
        {metrics.map(({ label, value, detail, icon: Icon, link }) => (
          <Link className="metric-card" href={`/${link}`} key={label}>
            <div>
              {label}
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{detail}</small>
          </Link>
        ))}
      </div>
      <div className="admin-overview-secondary">
        <section className="panel">
          <SectionHeading
            title="Coming up"
            detail="Your next scheduled conversations"
            action={
              <Link className="text-link" href={path("spaces")}>
                All Spaces
                <ArrowUpRight size={15} />
              </Link>
            }
          />
          {upcoming.slice(0, 3).map((session, i) => (
            <Link
              className="upcoming-row"
              href={path("spaces", session.id)}
              key={session.id}
            >
              <span className="upcoming-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <b>{session.title}</b>
                <small>{london(session.startsAt)}</small>
              </div>
              <span className="upcoming-seats">
                {approvedSeats(s, session.id)}/{session.capacity}
                <small>projects</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          ))}
          {!upcoming.length && <Empty>No upcoming Spaces scheduled.</Empty>}
        </section>
        <section className="panel">
          <SectionHeading
            title="Programme directory"
            detail="People and projects in your workspace"
          />
          <div className="directory-summary">
            <Link href={path("founders")}>
              <Users size={22} />
              <div>
                <strong>{s.founders.length}</strong>
                <span>Founders</span>
              </div>
              <ArrowUpRight size={17} />
            </Link>
            <Link href={path("companies")}>
              <Building2 size={22} />
              <div>
                <strong>{s.companies.length}</strong>
                <span>Companies</span>
              </div>
              <ArrowUpRight size={17} />
            </Link>
          </div>
          {!s.founders.length && (
            <p className="panel-help">
              Approved applications create linked founder and company records.
              You can also add existing contacts manually.
            </p>
          )}
        </section>
      </div>
      {pending.length > 0 && (
        <section className="panel">
          <SectionHeading
            title="Applications to review"
            action={
              <Link
                className="text-link"
                href={`${path("spaces")}?tab=applications`}
              >
                View all
                <ArrowUpRight size={15} />
              </Link>
            }
          />
          <div className="overview-applications">
            {pending.slice(0, 4).map((a) => (
              <Link
                className="entity-row"
                href={`${path("spaces")}?tab=applications&review=${encodeURIComponent(a.id)}`}
                key={a.id}
              >
                <Avatar name={a.founderName} />
                <span>
                  <b>{a.founderName}</b>
                  <small>
                    {a.companyName} · {a.country}
                  </small>
                </span>
                <Status value={a.status} />
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </section>
      )}
      {needsResults.length > 0 && (
        <section className="panel">
          <SectionHeading
            title="Attendance to complete"
            detail="Past sessions needing a results submission"
          />
          {needsResults.slice(0, 3).map((session) => (
            <Link
              className="entity-row"
              href={path("spaces", session.id)}
              key={session.id}
            >
              <Mic2 size={20} />
              <span>
                <b>{session.title}</b>
                <small>{london(session.startsAt)}</small>
              </span>
              <ArrowRight size={17} />
            </Link>
          ))}
        </section>
      )}
      <section className="panel programme-results">
        <SectionHeading
          title="Recorded programme results"
          detail="Cumulative attendance across recorded Spaces; missing values are shown as not recorded."
          action={
            viewer.permissions.includes("reports.read") ? (
              <Link className="text-link" href={path("reports")}>
                View reports
                <ArrowUpRight size={15} />
              </Link>
            ) : undefined
          }
        />
        <div className="results-strip">
          {[
            ["Founder attendance", totals.founders],
            ["Total attendance", totals.people],
            ["Live listeners", totals.listeners],
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
      </section>
      {s.founders.length > 0 && (
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
      )}
      {s.audit.length > 0 && (
        <section className="panel">
          <SectionHeading title="Recent activity" />
          <div className="admin-activity">
            {s.audit
              .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 4)
              .map((a) => (
                <div key={a.id}>
                  <span className="activity-dot" />
                  <div>
                    <b>{a.action.replaceAll(".", " · ")}</b>
                    <small>{a.actor}</small>
                  </div>
                  <time>
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    }).format(new Date(a.createdAt))}{" "}
                    UTC
                  </time>
                </div>
              ))}
          </div>
        </section>
      )}
    </>
  );
}
