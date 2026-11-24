"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Status, Empty, ExternalLink } from "@/components/ui";
import { approvedSeats } from "@/lib/domain";
import { LONDON_TIME_ZONE } from "@/lib/dates/saturday-schedule";

const sessionDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: LONDON_TIME_ZONE,
});
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
      {rows.length > 0 && (
        <div
          className="table-wrap"
          role="region"
          aria-label="Space sessions"
          tabIndex={0}
        >
          <table
            className="studio-sessions-table"
            aria-label="Scheduled and past Spaces"
          >
            <thead>
              <tr>
                <th scope="col">Space</th>
                <th scope="col">Date and time (UK)</th>
                <th scope="col">Status</th>
                <th scope="col">Projects booked</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((session) => (
                <tr key={session.id}>
                  <th scope="row">
                    <Link href={path("spaces", session.id)}>
                      {session.title}
                    </Link>
                  </th>
                  <td>{sessionDate.format(new Date(session.startsAt))}</td>
                  <td>
                    <Status value={session.status} />
                  </td>
                  <td>
                    {approvedSeats(s, session.id)} / {session.capacity}
                  </td>
                  <td>
                    <Link
                      className="text-link"
                      href={path("spaces", session.id)}
                    >
                      Manage <ArrowUpRight size={13} aria-hidden="true" />
                    </Link>
                    {session.recordingUrl && (
                      <ExternalLink href={session.recordingUrl}>
                        Recording
                      </ExternalLink>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!rows.length && <Empty>No sessions match this status.</Empty>}
    </section>
  );
}
