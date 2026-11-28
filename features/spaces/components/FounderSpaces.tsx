"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import {
  profileSpaceWeeks,
  durationLabel,
} from "@/features/spaces/lib/space-data";
import { dateTime } from "@/lib/dates/format";
import { ExternalLink } from "@/components/ui";
import WeeklySpaceEditor from "@/features/spaces/components/WeeklySpaceEditor";
export default function FounderSpaces({
  founderId,
  companyId,
}: {
  founderId?: string;
  companyId?: string;
}) {
  const { state: s, path } = useWorkspace();
  const weeks = profileSpaceWeeks(s, { founderId, companyId });
  const [selected, setSelected] = useState("");
  const week = weeks.find((w) => w.session.id === selected) || weeks[0];
  if (!week)
    return (
      <section className="panel padded directory-history-empty">
        <h2>Space history</h2>
        <p>No Spaces linked yet.</p>
      </section>
    );
  return (
    <details className="panel directory-history">
      <summary>
        <strong>Space history</strong>
        <span>
          {weeks.length} {weeks.length === 1 ? "Space" : "Spaces"}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <section
        className="founder-weekly-spaces"
        aria-label="Weekly Space attendance"
      >
        <div className="section-heading">
          <h2>Space details</h2>
          <WeeklySpaceEditor session={week.session} />
        </div>
        <label className="profile-week-picker">
          Choose a Space
          <select
            aria-label="Choose a Space"
            value={week.session.id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {weeks.map((w) => (
              <option value={w.session.id} key={w.session.id}>
                {w.session.title} · {w.session.startsAt.slice(0, 10)}
              </option>
            ))}
          </select>
        </label>
        <div className="weekly-space-heading">
          <Link className="text-link" href={path("spaces", week.session.id)}>
            {week.session.title}
            <ArrowUpRight size={14} />
          </Link>
          <small>{dateTime(week.session.startsAt)} · UTC / GMT</small>
          <ExternalLink href={week.session.postUrl}>Weekly X post</ExternalLink>
          <ExternalLink href={week.session.liveUrl}>Weekly Space</ExternalLink>
          <ExternalLink href={week.session.recordingUrl}>
            {companyId ? "Shared session recording" : "Session recording"}
          </ExternalLink>
        </div>
        <div className="metric-grid weekly-shared-metrics">
          {[
            {
              label: "Founders in this Space",
              value: week.totals.founders,
              key: "founders",
            },
            {
              label: "All team attendees",
              value: week.totals.people,
              key: "people",
            },
            {
              label: "Live listeners",
              value: week.totals.listeners,
              key: "listeners",
            },
            {
              label: "Space duration",
              value: durationLabel(week.totals.durationMinutes),
              key: "duration",
            },
          ].map(({ label, value, key }) => (
            <div className="metric-card" key={key}>
              <div>{label}</div>
              <strong data-testid={`week-${key}`}>{value ?? "—"}</strong>
            </div>
          ))}
        </div>
        <div className="weekly-own-teams">
          <h3>
            {companyId ? "This team’s attendance" : "Their team attendance"}
          </h3>
          {week.teams
            .filter((t) => t.own)
            .map((t) => (
              <div className="weekly-team-card" key={t.company.id}>
                <strong>{t.company.name}</strong>
                <dl>
                  <div>
                    <dt>Founders attended</dt>
                    <dd data-testid={`project-founders-${t.company.id}`}>
                      {t.foundersCount ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Other team members</dt>
                    <dd data-testid={`project-members-${t.company.id}`}>
                      {t.otherTeamCount ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Total attended</dt>
                    <dd data-testid={`project-people-${t.company.id}`}>
                      {t.people ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Speakers expected</dt>
                    <dd>{t.speakers ?? "—"}</dd>
                  </div>
                </dl>
              </div>
            ))}
        </div>
        <div className="section-heading">
          <h3>Teams in the same Space</h3>
        </div>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Teams in this weekly Space"
        >
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Founders</th>
                <th>Speakers expected</th>
                <th>Founders attended</th>
                <th>Other team members</th>
                <th>Total attended</th>
              </tr>
            </thead>
            <tbody>
              {week.teams.map((t) => (
                <tr key={t.company.id} className={t.own ? "own-week-team" : ""}>
                  <td>
                    <Link
                      className="text-link"
                      href={path("companies", t.company.id)}
                    >
                      {t.company.name}
                    </Link>
                  </td>
                  <td>
                    {t.founders.length
                      ? t.founders.map((f, index) => (
                          <span key={f.id}>
                            {index > 0 ? ", " : ""}
                            <Link
                              className="text-link"
                              href={path("founders", f.id)}
                            >
                              {f.name}
                            </Link>
                          </span>
                        ))
                      : "—"}
                  </td>
                  <td>{t.speakers ?? "—"}</td>
                  <td>{t.foundersCount ?? "—"}</td>
                  <td>{t.otherTeamCount ?? "—"}</td>
                  <td>{t.people ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="weekly-shared-caption">
          Attendance is recorded separately for each project.
        </p>
      </section>
    </details>
  );
}
