"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Avatar, Status, Empty, ExternalLink } from "@/components/ui";
import { approvedSeats } from "@/lib/domain";
import { dateTime } from "@/lib/dates/format";
import type { DataState } from "@/lib/types";
export default function SessionList({
  sessions,
  filter,
}: {
  sessions: DataState["sessions"];
  filter: string;
}) {
  const { state: s, path } = useWorkspace();
  const rows = sessions
    .filter((session) => filter === "All" || session.status === filter)
    .sort((a, b) => {
      if (a.status === "Scheduled" && b.status === "Scheduled")
        return a.startsAt.localeCompare(b.startsAt);
      if (a.status === "Scheduled") return -1;
      if (b.status === "Scheduled") return 1;
      return b.startsAt.localeCompare(a.startsAt);
    });
  return (
    <section className="panel session-agenda">
      <div className="section-heading">
        <h2>Sessions</h2>
        <span className="small-tag">{rows.length} Spaces</span>
      </div>
      {rows.map((v, i) => {
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
            <p>{dateTime(v.startsAt)} · UTC / GMT</p>
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
      {!rows.length && <Empty>No sessions match this status.</Empty>}
    </section>
  );
}
