"use client";
import ApplicationReview from "./ApplicationReview";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowLeft, Mic2, Pencil, Users } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import {
  Avatar,
  Status,
  SectionHeading,
  Modal,
  Empty,
  ExternalLink,
} from "@/components/ui";
import { spaceTotals } from "@/features/spaces/lib/space-data";
import { approvedSeats } from "@/lib/domain";
import { dateTime } from "@/lib/dates/format";
import { BOOKING_STATUSES } from "@/lib/catalog";

import WeeklySpaceEditor from "@/features/spaces/components/WeeklySpaceEditor";
import SessionList from "@/features/spaces/components/SessionList";
import type { Resource } from "@/components/shared/RecordEditor";
type Editor = (resource: Resource, record?: Record<string, unknown>) => void;
export type SpaceTab = "sessions" | "applications" | "bookings";
export default function Spaces({
  id,
  edit,
  embedded,
}: {
  id?: string;
  edit: Editor;
  embedded?: { tab: SpaceTab; onChange: (tab: SpaceTab) => void };
}) {
  const { state: s, viewer, path, commit, busy } = useWorkspace(),
    router = useRouter(),
    params = useSearchParams();
  const tab = embedded?.tab ?? (params.get("tab") || "sessions");
  const requestedReview = params.get("review");
  const [reviewState, setReviewState] = useState({
    url: requestedReview,
    id: requestedReview || "",
  });
  if (reviewState.url !== requestedReview)
    setReviewState({ url: requestedReview, id: requestedReview || "" });
  const setSelected = (id: string | null) =>
    setReviewState({ url: requestedReview, id: id || "" });
  const [filterState, setFilterState] = useState({
    tab,
    value: params.get("status") || "All",
  });
  const statuses =
    tab === "sessions"
      ? ["Scheduled", "Completed", "Cancelled"]
      : tab === "applications"
        ? ["Pending", "Approved", "Waitlisted", "Declined"]
        : BOOKING_STATUSES;
  const filter =
    filterState.tab === tab && ["All", ...statuses].includes(filterState.value)
      ? filterState.value
      : "All";
  const setFilter = (value: string) => setFilterState({ tab, value });
  const a = s.applications.find((v) => v.id === reviewState.id),
    can = viewer.permissions.includes("booking.write");
  const session = s.sessions.find((v) => v.id === id);
  const bookingSessionId = params.get("session");
  const visibleBookings = s.bookings.filter(
    (b) =>
      (!bookingSessionId || b.sessionId === bookingSessionId) &&
      (filter === "All" || b.status === filter),
  );
  const actual = spaceTotals(s, id);
  const closeReview = () => {
    setSelected(null);
    if (params.has("review")) {
      const next = new URLSearchParams(params.toString());
      next.delete("review");
      router.replace(
        `${path(embedded ? "operations" : "spaces")}?${next.toString()}`,
        { scroll: false },
      );
    }
  };
  return (
    <>
      {id && session ? (
        <>
          <Link className="back-link" href={path("spaces")}>
            <ArrowLeft size={16} /> All Spaces
          </Link>
          <div className="page-heading">
            <div>
              <h1>{session.title}</h1>
              <p>
                {dateTime(session.startsAt)} · UTC / GMT · Hosted by{" "}
                {session.host}
              </p>
            </div>
            {can && (
              <button
                className="button primary"
                onClick={() =>
                  edit("session", session as unknown as Record<string, unknown>)
                }
              >
                <Pencil size={16} /> Edit session & recording
              </button>
            )}
          </div>
          <WeeklySpaceEditor session={session} />
          <div className="metric-grid three">
            <section className="metric-card">
              <div>
                Projects booked <Users size={18} />
              </div>
              <strong>
                {approvedSeats(s, session.id)} <span>/ {session.capacity}</span>
              </strong>
              <small>Booking capacity</small>
            </section>
            <section className="metric-card">
              <div>
                People expected <Mic2 size={18} />
              </div>
              <strong>
                {s.participants
                  .filter(
                    (p) => p.sessionId === id && p.attendance !== "Cancelled",
                  )
                  .reduce((n, p) => n + p.speakers, 0)}
              </strong>
              <small>From approved bookings</small>
            </section>
            <section className="metric-card">
              <div>People attended</div>
              <strong>{actual.people ?? "—"}</strong>
              <small>
                {actual.founders === null
                  ? "No actual attendance entered yet"
                  : `${actual.founders} founders attended`}
              </small>
            </section>
          </div>
          <section className="panel padded">
            <div className="row-between">
              <h2>Session links</h2>
              <Status value={session.status} />
            </div>
            <div className="inline">
              <ExternalLink href={session.postUrl}>Weekly X post</ExternalLink>
              <ExternalLink href={session.liveUrl}>Live Space</ExternalLink>
              <ExternalLink href={session.recordingUrl}>
                Shared session recording
              </ExternalLink>
            </div>
            {!session.recordingUrl && (
              <p>
                No recording link yet. Paste it once in Edit session &
                recording.
              </p>
            )}
            <p>{session.notes || "No internal notes."}</p>
          </section>
          <section className="panel">
            <SectionHeading title="Booked founders" />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Founder</th>
                    <th>Company</th>
                    <th>People expected</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {s.participants
                    .filter((p) => p.sessionId === id)
                    .map((p, i) => {
                      const f = s.founders.find((v) => v.id === p.founderId),
                        c = s.companies.find((v) => v.id === p.companyId);
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link
                              className="table-person"
                              href={path("founders", p.founderId)}
                            >
                              <Avatar name={f?.name || "Founder"} index={i} />
                              <b>{f?.name}</b>
                            </Link>
                          </td>
                          <td>
                            <Link href={path("companies", p.companyId)}>
                              {c?.name}
                            </Link>
                          </td>
                          <td>{p.speakers}</td>
                          <td>
                            <Status value={p.attendance} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {!s.participants.some((p) => p.sessionId === id) && (
                <Empty>No approved founder-project seats yet.</Empty>
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="page-heading">
            <div>
              {embedded ? <h2>Founder Spaces</h2> : <h1>Founder Spaces</h1>}
              <p>
                Prepare your sessions, review applications and manage project
                seats.
              </p>
            </div>
            <div className="heading-actions">
              {can && (
                <button
                  className="button primary"
                  onClick={() => edit("session")}
                >
                  <Plus size={16} /> Create Space
                </button>
              )}
            </div>
          </div>
          <div className="tab-row">
            {[
              ["sessions", "Sessions"],
              ["applications", "Applications"],
              ["bookings", "Bookings"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={tab === value ? "active" : ""}
                aria-pressed={tab === value}
                onClick={() => {
                  if (embedded) embedded.onChange(value as SpaceTab);
                  else router.replace(`${path("spaces")}?tab=${value}`);
                }}
              >
                {label}
                {value === "applications" && (
                  <span>
                    {
                      s.applications.filter((a) => a.status === "Pending")
                        .length
                    }
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="filter-bar">
            <label>
              Status
              <select
                aria-label="Space workflow status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  "All",
                  ...(tab === "sessions"
                    ? ["Scheduled", "Completed", "Cancelled"]
                    : tab === "applications"
                      ? ["Pending", "Approved", "Waitlisted", "Declined"]
                      : BOOKING_STATUSES),
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {tab === "bookings" && bookingSessionId && (
              <Link
                className="text-link"
                href={path("spaces") + "?tab=bookings"}
              >
                View all bookings
              </Link>
            )}
            <span className="muted">
              {tab === "sessions"
                ? "Default capacity: four founder projects, not five speakers."
                : tab === "bookings"
                  ? "Requests need approval; a pending request does not reserve a seat."
                  : "Review founder applications and booking requests."}
            </span>
          </div>
          {tab === "sessions" ? (
            <SessionList sessions={s.sessions} filter={filter} />
          ) : tab === "applications" ? (
            <section className="panel">
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Applications table"
              >
                <table
                  className="studio-applications-table"
                  aria-label="Founder applications"
                >
                  <thead>
                    <tr>
                      <th scope="col">Founder / company</th>
                      <th scope="col">Country</th>
                      <th scope="col">Team</th>
                      <th scope="col">People expected</th>
                      <th scope="col">Status</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.applications
                      .filter((a) => filter === "All" || a.status === filter)
                      .map((a, i) => (
                        <tr key={a.id}>
                          <th scope="row">
                            <button
                              className="table-person align-left"
                              onClick={() => setSelected(a.id)}
                            >
                              <Avatar name={a.founderName} index={i} />
                              <span>
                                <b>{a.founderName}</b>
                                <small>
                                  {a.companyName} · {a.reference}
                                </small>
                              </span>
                            </button>
                          </th>
                          <td>{a.country}</td>
                          <td>{a.teamSize}</td>
                          <td>{a.speakers}</td>
                          <td>
                            <Status value={a.status} />
                          </td>
                          <td>
                            <button
                              className="button"
                              onClick={() => setSelected(a.id)}
                            >
                              Review application
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!s.applications.some(
                (a) => filter === "All" || a.status === filter,
              ) && (
                <Empty
                  title={
                    filter === "All"
                      ? "No applications to review"
                      : "No matching applications"
                  }
                >
                  New submissions will appear here. Try another status if you
                  have filters selected.
                </Empty>
              )}
            </section>
          ) : (
            <section className="panel">
              {visibleBookings.length ? (
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Booking requests table"
                >
                  <table
                    className="studio-bookings-table"
                    aria-label="Founder booking requests"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Project / founder</th>
                        <th scope="col">Status</th>
                        <th scope="col">Space</th>
                        <th scope="col">People expected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleBookings.map((booking) => {
                        const application = s.applications.find(
                          (item) => item.id === booking.applicationId,
                        );
                        const session = s.sessions.find(
                          (item) => item.id === booking.sessionId,
                        );
                        const project =
                          application?.companyName || "Founder project";
                        return (
                          <tr key={booking.id}>
                            <th scope="row">
                              {project}
                              {application?.founderName && (
                                <small>{application.founderName}</small>
                              )}
                            </th>
                            <td>
                              {can ? (
                                <select
                                  className="booking-status-control"
                                  data-status={booking.status}
                                  aria-label={`Booking status for ${project}`}
                                  disabled={busy}
                                  value={booking.status}
                                  onChange={(e) =>
                                    void commit({
                                      type: "booking.review",
                                      payload: {
                                        id: booking.id,
                                        status: e.target.value,
                                      },
                                    })
                                  }
                                >
                                  {BOOKING_STATUSES.map((status) => (
                                    <option key={status}>{status}</option>
                                  ))}
                                </select>
                              ) : (
                                <Status value={booking.status} />
                              )}
                            </td>
                            <td>
                              <Link
                                className="text-link"
                                href={path("spaces", booking.sessionId)}
                              >
                                {session?.title || "Open Space"}
                              </Link>
                              {session && (
                                <small>{dateTime(session.startsAt)} UTC</small>
                              )}
                            </td>
                            <td>{booking.speakers}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="No matching bookings">
                  Pending requests appear here. Approve a request to reserve a
                  project seat.
                </Empty>
              )}
            </section>
          )}
        </>
      )}
      {a && (
        <Modal
          title={`Application · ${a.reference}`}
          close={closeReview}
          wide
          className="application-dialog"
        >
          <ApplicationReview application={a} onSelect={setSelected} />
        </Modal>
      )}
    </>
  );
}
