"use client";
import BookingEditor from "@/features/bookings/components/BookingEditor";
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
  const [bookingApplication, setBookingApplication] = useState("");
  const [booking, setBooking] = useState(false),
    [filterState, setFilterState] = useState({
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
            <SectionHeading
              title="Booked founders"
              action={
                can ? (
                  <button className="button" onClick={() => setBooking(true)}>
                    <Plus size={14} /> Assign booking
                  </button>
                ) : null
              }
            />
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
                <>
                  <button className="button" onClick={() => setBooking(true)}>
                    New booking
                  </button>
                  <button
                    className="button primary"
                    onClick={() => edit("session")}
                  >
                    <Plus size={16} /> Create Space
                  </button>
                </>
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
            <section className="panel workflow-desktop">
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Founder applications"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Founder / company</th>
                      <th>Country</th>
                      <th>Team</th>
                      <th>People expected</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {s.applications
                      .filter((a) => filter === "All" || a.status === filter)
                      .map((a, i) => (
                        <tr key={a.id}>
                          <td>
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
                          </td>
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
                              Review
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
            <section className="panel workflow-desktop">
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Founder booking requests"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Space</th>
                      <th>People expected</th>
                      <th>Booking status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBookings.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <b>
                            {
                              s.applications.find(
                                (a) => a.id === b.applicationId,
                              )?.companyName
                            }
                          </b>
                          <small>
                            {
                              s.applications.find(
                                (a) => a.id === b.applicationId,
                              )?.founderName
                            }
                          </small>
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            href={path("spaces", b.sessionId)}
                          >
                            {
                              s.sessions.find((v) => v.id === b.sessionId)
                                ?.title
                            }
                          </Link>
                        </td>
                        <td>{b.speakers}</td>
                        <td>
                          {can ? (
                            <select
                              aria-label={`Booking status ${b.id}`}
                              disabled={busy}
                              value={b.status}
                              onChange={(e) =>
                                void commit({
                                  type: "booking.review",
                                  payload: {
                                    id: b.id,
                                    status: e.target.value,
                                  },
                                })
                              }
                            >
                              {BOOKING_STATUSES.map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          ) : (
                            <Status value={b.status} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visibleBookings.length && (
                  <Empty title="No matching bookings">
                    Pending requests appear here. Approve a request to reserve a
                    project seat.
                  </Empty>
                )}
              </div>
            </section>
          )}
          {tab === "applications" && (
            <div className="workflow-mobile">
              {s.applications
                .filter((a) => filter === "All" || a.status === filter)
                .map((item, i) => (
                  <article className="workflow-card" key={item.id}>
                    <div className="workflow-card-heading">
                      <Avatar name={item.founderName} index={i} />
                      <div>
                        <b>{item.founderName}</b>
                        <small>{item.companyName}</small>
                      </div>
                    </div>
                    <p>
                      {item.country} · {item.speakers} speakers ·{" "}
                      {item.reference}
                    </p>
                    <div className="workflow-card-footer">
                      <Status value={item.status} />
                      <button
                        className="button primary"
                        onClick={() => setSelected(item.id)}
                      >
                        Review application
                      </button>
                    </div>
                  </article>
                ))}
              {!s.applications.some(
                (a) => filter === "All" || a.status === filter,
              ) && (
                <section className="panel">
                  <Empty title="No applications to review">
                    New founder submissions will appear here.
                  </Empty>
                </section>
              )}
            </div>
          )}
          {tab === "bookings" && (
            <div className="workflow-mobile">
              {s.bookings
                .filter((b) => filter === "All" || b.status === filter)
                .map((b) => {
                  const application = s.applications.find(
                    (a) => a.id === b.applicationId,
                  );
                  return (
                    <article className="workflow-card" key={b.id}>
                      <b>{application?.companyName || "Founder project"}</b>
                      <small>{application?.founderName}</small>
                      <p>
                        {s.sessions.find((v) => v.id === b.sessionId)?.title}
                      </p>
                      <Link
                        className="text-link"
                        href={path("spaces", b.sessionId)}
                      >
                        Open Space
                        <ArrowLeft size={15} />
                      </Link>
                      {can ? (
                        <label>
                          Booking status
                          <select
                            aria-label={`Booking status ${b.id}`}
                            disabled={busy}
                            value={b.status}
                            onChange={(e) =>
                              void commit({
                                type: "booking.review",
                                payload: { id: b.id, status: e.target.value },
                              })
                            }
                          >
                            {BOOKING_STATUSES.map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <Status value={b.status} />
                      )}
                    </article>
                  );
                })}
              {!s.bookings.some(
                (b) => filter === "All" || b.status === filter,
              ) && (
                <section className="panel">
                  <Empty title="No matching bookings">
                    Requests appear here before project seats are approved.
                  </Empty>
                </section>
              )}
            </div>
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
          <ApplicationReview
            application={a}
            onSelect={setSelected}
            onAssign={() => {
              setBookingApplication(a.id);
              closeReview();
              setBooking(true);
            }}
          />
        </Modal>
      )}
      {booking && (
        <BookingEditor
          sessionId={id}
          preferredApplicationId={bookingApplication}
          close={() => {
            setBooking(false);
            setBookingApplication("");
          }}
        />
      )}
    </>
  );
}
