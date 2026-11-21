"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Users,
  Building2,
  Globe2,
  Mic2,
  ArrowRight,
  CalendarDays,
  Plus,
  Lightbulb,
  BriefcaseBusiness,
  CheckCircle2,
} from "lucide-react";
import { countryRegion } from "@/lib/catalog";
import { chartPalette } from "@/lib/design";
import { useWorkspace } from "./WorkspaceContext";
import {
  reportData,
  blankFilters,
  growthData,
  dateTime,
} from "@/lib/selectors";
import { Avatar, Status, SectionHeading, Empty } from "./ui";
const Chart = dynamic(() => import("./Charts"), {
  ssr: false,
  loading: () => <div className="chart skeleton" aria-label="Loading chart" />,
});
export default function Overview({ addFounder }: { addFounder: () => void }) {
  const { state: s, viewer, path, demo } = useWorkspace();
  const [country, setCountry] = useState("");
  const r = reportData(s, { ...blankFilters, country });
  const regions = Object.entries(
    r.founders.reduce<Record<string, number>>((counts, f) => {
      const region = countryRegion(f.country);
      counts[region] = (counts[region] || 0) + 1;
      return counts;
    }, {}),
  ).map(([name, value]) => ({ name, value }));
  const pending = s.applications.filter((a) => a.status === "Pending");
  const completed = s.sessions.filter((v) => v.status === "Completed"),
    upcoming = s.sessions
      .filter((v) => v.status === "Scheduled")
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const campaign = s.campaigns.filter((c) => c.status === "Open").at(-1);
  const cohortCount = s.campaignParticipants.filter(
    (p) => p.campaignId === campaign?.id,
  ).length;
  const cards = [
    {
      name: "Founders",
      value: r.founders.length,
      icon: Users,
      detail: "People, not just projects",
      link: "founders",
    },
    {
      name: "Companies",
      value: r.companies.length,
      icon: Building2,
      detail: "Products with a clearer picture",
      link: "companies",
    },
    {
      name: "Countries",
      value: r.countries.length,
      icon: Globe2,
      detail: "An African focus. A global outlook.",
      link: "founders",
    },
    {
      name: "Spaces",
      value: completed.length,
      icon: Mic2,
      detail: `${upcoming.length} upcoming sessions`,
      link: "spaces",
    },
  ];
  cards.push(
    {
      name: "Business needs",
      value: r.needs.length,
      icon: Lightbulb,
      detail: "",
      link: "research",
    },
    {
      name: "Integrations",
      value: r.integrations.length,
      icon: Building2,
      detail: "",
      link: "market-map",
    },
    {
      name: "Partnerships",
      value: r.partnerships.length,
      icon: Users,
      detail: "",
      link: "market-map",
    },
    {
      name: "Hiring signals",
      value: r.hiring.length,
      icon: BriefcaseBusiness,
      detail: "",
      link: "opportunities",
    },
  );
  const bookingAccess = viewer.permissions.includes("booking.read");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
        </div>
        <div className="heading-actions">
          <Link className="button" href={path("reports")}>
            View report <ArrowUpRight size={15} />
          </Link>
          {viewer.permissions.includes("directory.write") && (
            <button className="button primary" onClick={addFounder}>
              <Plus size={16} /> Add founder
            </button>
          )}
        </div>
      </div>
      <div className="overview-meta">
        <span>
          <CalendarDays size={14} />
          {demo
            ? "November 2026"
            : new Date().toLocaleDateString("en", {
                month: "long",
                year: "numeric",
              })}
        </span>
        <label>
          Coverage
          <select
            aria-label="Overview country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">All countries</option>
            {Array.from(new Set(s.founders.map((f) => f.country)))
              .sort()
              .map((c) => (
                <option key={c}>{c}</option>
              ))}
          </select>
        </label>
      </div>
      <div className="metric-grid">
        {cards.map(({ name, value, icon: Icon, link }) => (
          <Link className="metric-card" key={name} href={path(link)}>
            <div>
              <span>{name}</span>
              <Icon size={19} />
            </div>
            <strong>{name === "Spaces" && !bookingAccess ? "—" : value}</strong>
          </Link>
        ))}
      </div>
      <div className="dashboard-main-grid">
        <section className="panel growth-panel">
          <SectionHeading
            title="Founder growth"
            detail="Cumulative founders from the records in this workspace"
            action={<span className="small-tag">All time</span>}
          />
          <div className="chart-summary">
            <strong>{s.founders.length}</strong>
            <span>
              founders documented{" "}
              <span className="muted">
                · {growthData(s).length} months of records
              </span>
            </span>
          </div>
          <Chart label="Founder growth" data={growthData(s)} type="area" />
        </section>
        <section className="panel country-panel">
          <SectionHeading
            title="By region"
            detail={`${r.countries.length} countries represented`}
          />
          <div className="region-chart">
            <Chart
              label="Founder regions"
              type="donut"
              data={regions}
              center={{ value: r.founders.length, label: "Founders" }}
            />
          </div>
          <div className="region-legend">
            {regions.map((v, i) => (
              <div key={v.name}>
                <i
                  style={{ background: chartPalette[i % chartPalette.length] }}
                />
                <span>{v.name}</span>
                <b>
                  {Math.round((v.value / Math.max(1, r.founders.length)) * 100)}
                  %
                </b>
              </div>
            ))}
          </div>
          <Link className="panel-bottom-link" href={path("founders")}>
            Explore the founder directory <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <div className="signal-strip">
        {[
          {
            label: "Awaiting review",
            value: bookingAccess ? pending.length : "—",
            icon: Users,
            link: "spaces",
          },
          {
            label: "Research complete",
            value: r.founders.length
              ? `${Math.round((100 * r.covered) / r.founders.length)}%`
              : "0%",
            icon: CheckCircle2,
            link: "research",
          },
          {
            label: "Business needs",
            value: r.needs.length,
            icon: Lightbulb,
            link: "research",
          },
          {
            label: "Active opportunities",
            value: r.opportunities.filter(
              (o) => !["Won", "Lost", "Not a fit"].includes(o.status),
            ).length,
            icon: BriefcaseBusiness,
            link: "opportunities",
          },
        ].map(({ label, value, icon: Icon, link }) => (
          <Link key={label} href={path(link)}>
            <span className="signal-icon">
              <Icon size={17} />
            </span>
            <span>
              <b>{value}</b>
              <small>{label}</small>
            </span>
            <ArrowUpRight size={14} />
          </Link>
        ))}
      </div>
      <div className="dashboard-main-grid">
        <section className="panel">
          <SectionHeading
            title="The next conversations"
            detail="Weekly Spaces, thoughtful questions, useful connections"
            action={
              <Link className="text-link" href={path("spaces")}>
                All Spaces <ArrowUpRight size={14} />
              </Link>
            }
          />
          {upcoming.slice(0, 3).map((session) => (
            <Link
              key={session.id}
              className="upcoming-session"
              href={path("spaces", session.id)}
            >
              <span className="date-block">
                <small>
                  {new Date(session.startsAt)
                    .toLocaleDateString("en", { month: "short" })
                    .toUpperCase()}
                </small>
                <b>{new Date(session.startsAt).getUTCDate()}</b>
              </span>
              <span>
                <b>{session.title}</b>
                <small>
                  {dateTime(session.startsAt, session.timezone)} ·{" "}
                  {session.timezone}
                </small>
              </span>
              <span className="desktop-only">
                <Status value="Scheduled" />
              </span>
              <ArrowUpRight size={15} />
            </Link>
          ))}
          {!upcoming.length && <Empty>No upcoming sessions yet.</Empty>}
        </section>
        <section className="campaign-highlight">
          <div className="eyebrow">THIS MONTH’S PROGRAMME</div>
          <div className="campaign-symbol">
            <Lightbulb size={27} strokeWidth={1.4} />
          </div>
          <h2>{campaign?.name || "Build the next founder cohort"}</h2>
          <p>
            Bring {campaign?.target || 20} founders into the room. Turn their
            stories into shared intelligence.
          </p>
          <div className="cohort-progress">
            <b>
              {cohortCount}
              <span> / {campaign?.target || 20} founders</span>
            </b>
            <span className="progress">
              <i
                style={{
                  width: `${Math.min(100, (100 * cohortCount) / (campaign?.target || 20))}%`,
                }}
              />
            </span>
          </div>
          <Link href={path("campaigns")}>
            Manage campaign <ArrowUpRight size={15} />
          </Link>
          <small>
            {campaign?.awardAmount || "1 SOL"} monthly award · human-reviewed
          </small>
        </section>
      </div>
      <div className="three-grid">
        <section className="panel">
          <SectionHeading
            title="Product stages"
            detail="Company product stages"
          />
          <Chart label="Product stages" data={r.stages} />
        </section>
        <section className="panel">
          <SectionHeading
            title="Top business needs"
            detail="Explicit needs from recorded evidence"
          />
          <Chart
            label="Business needs"
            data={r.businessNeeds}
            type="horizontal"
          />
        </section>
        <section className="panel">
          <SectionHeading
            title="By sector"
            detail="Primary sectors, not competitor assumptions"
          />
          <Chart label="Sectors" data={r.sectors} type="donut" />
          <div className="chart-legend">
            {r.sectors.map((v) => (
              <span key={v.name}>
                {v.name} <b>{v.value}</b>
              </span>
            ))}
          </div>
        </section>
      </div>
      <section className="panel">
        <SectionHeading
          title="Opportunity pipeline"
          detail="Private hypotheses and commercial follow-ups"
        />
        <Chart label="Opportunity pipeline" data={r.pipeline} />
        <div className="coverage-metrics">
          <span>
            <b>{r.integrations.length}</b> Integration candidates
          </span>
          <span>
            <b>{r.partnerships.length}</b> Partnership candidates
          </span>
          <span>
            <b>{r.hiring.length}</b> Explicit hiring signals
          </span>
          <span>
            <b>{s.awards.filter((a) => a.status === "Selected").length}</b>{" "}
            Awards selected
          </span>
        </div>
      </section>
      {bookingAccess && (
        <section className="panel">
          <SectionHeading
            title="Applications to get to know"
            detail="The next founders waiting for a conversation"
            action={
              <Link
                className="text-link"
                href={path("spaces") + "?tab=applications"}
              >
                Review applications <ArrowRight size={14} />
              </Link>
            }
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Founder / company</th>
                  <th>Country</th>
                  <th>Sector</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.slice(0, 5).map((a, i) => (
                  <tr key={a.id}>
                    <td>
                      <div className="table-person">
                        <Avatar name={a.founderName} index={i} />
                        <span>
                          <b>{a.founderName}</b>
                          <small>{a.companyName}</small>
                        </span>
                      </div>
                    </td>
                    <td>{a.country}</td>
                    <td>{a.sector}</td>
                    <td>{a.stage}</td>
                    <td>
                      <Status value={a.status} />
                    </td>
                    <td>
                      <Link
                        className="icon-button"
                        aria-label={`Review ${a.companyName}`}
                        href={path("spaces") + "?tab=applications"}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!pending.length && <Empty>No applications awaiting review.</Empty>}
          </div>
        </section>
      )}
      <div className="workspace-footnote">
        {demo
          ? "Fictional founders, real workflows."
          : "Private programme records."}{" "}
        Research samples reflect programme participation, not the entire Web3
        industry.
      </div>
    </>
  );
}
