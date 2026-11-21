"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowUpRight, Mic2 } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { Avatar, Status, Empty, ExternalLink } from "./ui";
import { approvedSeats } from "@/lib/domain";
import { dateTime } from "@/lib/selectors";
import type { DataState } from "@/lib/types";
export default function SessionCalendar({
  sessions,
  filter,
}: {
  sessions: DataState["sessions"];
  filter: string;
}) {
  const { state: s, path } = useWorkspace();
  const [month, setMonth] = useState(() => {
      const date = new Date(
        sessions.find((v) => v.status === "Scheduled")?.startsAt || Date.now(),
      );
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    }),
    [day, setDay] = useState<number | null>(null);
  const rows = sessions
    .filter(
      (v) =>
        (filter === "All" || v.status === filter) &&
        new Date(v.startsAt).getUTCMonth() === month.getUTCMonth() &&
        new Date(v.startsAt).getUTCFullYear() === month.getUTCFullYear(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const offset = (month.getUTCDay() + 6) % 7;
  function move(delta: number) {
    setMonth(
      new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1),
      ),
    );
    setDay(null);
  }
  return (
    <div className="spaces-workspace">
      <aside className="panel calendar-panel">
        <div className="row-between">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <b>
            {month.toLocaleDateString("en", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </b>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => move(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="calendar-grid">
          {["M", "T", "W", "T", "F", "S", "S"].map((v, i) => (
            <span className="calendar-weekday" key={i}>
              {v}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={"gap" + i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const n = i + 1;
            const events = rows.filter(
              (v) => new Date(v.startsAt).getUTCDate() === n,
            );
            return (
              <button
                key={n}
                aria-label={`${n} ${month.toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" })}${events.length ? `, ${events.length} sessions` : ""}`}
                aria-pressed={day === n}
                className={`${events.length ? "has-session" : ""} ${day === n ? "selected" : ""}`}
                onClick={() => setDay(day === n ? null : n)}
              >
                {n}
                {events.length > 0 && <i />}
              </button>
            );
          })}
        </div>
        <div className="calendar-key">
          <i />
          Session scheduled
        </div>
        <div className="calendar-summary">
          <Mic2 size={20} />
          <div>
            <strong>{rows.length}</strong>
            <span>Spaces this month</span>
          </div>
        </div>
        <button
          className="button full-width"
          onClick={() => {
            setDay(null);
          }}
        >
          Show full month
        </button>
      </aside>
      <section className="panel session-agenda">
        <div className="section-heading">
          <div>
            <h2>
              {day ? `${day} ` : ""}
              {month.toLocaleDateString("en", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </h2>
          </div>
          <span className="small-tag">{rows.length} Spaces</span>
        </div>
        {rows
          .filter((v) => !day || new Date(v.startsAt).getUTCDate() === day)
          .map((v, i) => {
            const people = s.participants.filter(
              (p) => p.sessionId === v.id && p.attendance !== "Cancelled",
            );
            return (
              <article className="agenda-session" key={v.id}>
                <div className="row-between">
                  <Link href={path("spaces", v.id)}>
                    <h3>{v.title}</h3>
                  </Link>
                  <Status value={v.status} />
                </div>
                <p>
                  {dateTime(v.startsAt, v.timezone)} · {v.timezone}
                </p>
                <div className="row-between">
                  <div className="participant-stack">
                    {people.slice(0, 5).map((p, j) => (
                      <Avatar
                        key={p.id}
                        name={
                          s.founders.find((f) => f.id === p.founderId)?.name ||
                          "Founder"
                        }
                        index={i + j}
                      />
                    ))}
                    <span>
                      {approvedSeats(s, v.id)} / {v.capacity} projects
                    </span>
                  </div>
                  {v.recordingUrl ? (
                    <ExternalLink href={v.recordingUrl}>Recording</ExternalLink>
                  ) : (
                    <Link className="text-link" href={path("spaces", v.id)}>
                      Manage
                      <ArrowUpRight size={13} />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        {!rows.filter((v) => !day || new Date(v.startsAt).getUTCDate() === day)
          .length && <Empty>No sessions on these dates.</Empty>}
      </section>
    </div>
  );
}
