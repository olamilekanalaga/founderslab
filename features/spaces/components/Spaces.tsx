"use client";
import BookingEditor from "@/features/bookings/components/BookingEditor";
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
import { dateTime, niceDate } from "@/lib/dates/format";
import { BOOKING_STATUSES } from "@/lib/catalog";

import DeleteRecordButton from "@/features/founders/components/DeleteRecordButton";
import WeeklySpaceEditor from "@/features/spaces/components/WeeklySpaceEditor";
import SessionCalendar from "@/features/spaces/components/SessionCalendar";
import type { Resource } from "@/components/shared/RecordEditor";
type Editor = (resource: Resource, record?: Record<string, unknown>) => void;
export default function Spaces({ id, edit }: { id?: string; edit: Editor }) {
  const { state: s, viewer, path, commit, busy } = useWorkspace(),
    router = useRouter(),
    params = useSearchParams();
  const tab = params.get("tab") || "sessions";
  const [selected, setSelected] = useState<string | null>(null),
    [booking, setBooking] = useState(false),
    [filter, setFilter] = useState("All");
  const a = s.applications.find((v) => v.id === selected),
    can = viewer.permissions.includes("booking.write");
  const session = s.sessions.find((v) => v.id === id);
  const bookingSessionId = params.get("session");
  const visibleBookings = s.bookings.filter(
    (b) =>
      (!bookingSessionId || b.sessionId === bookingSessionId) &&
      (filter === "All" || b.status === filter),
  );
  const actual = spaceTotals(s, id);
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
              <h1>Founder Spaces</h1>
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
                onClick={() => router.replace(`${path("spaces")}?tab=${value}`)}
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
                ? "Default capacity: five founder projects, not five speakers."
                : tab === "bookings"
                  ? "Requests need approval; a pending request does not reserve a seat."
                  : "Review founder applications and booking requests."}
            </span>
          </div>
          {tab === "sessions" ? (
            <SessionCalendar sessions={s.sessions} filter={filter} />
          ) : tab === "applications" ? (
            <section className="panel">
              <div className="table-wrap">
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
            </section>
          ) : (
            <section className="panel">
              <div className="table-wrap">
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
                  <Empty>No matching bookings.</Empty>
                )}
              </div>
            </section>
          )}
        </>
      )}
      {a && (
        <Modal
          title={`Application · ${a.reference}`}
          close={() => setSelected(null)}
          wide
        >
          <DeleteRecordButton
            kind="application"
            id={a.id}
            name={a.founderName}
          />
          <div className="application-review">
            <div className="row-between">
              <div>
                <h3>{a.companyName}</h3>
                <p>
                  {a.founderName} · @{a.xHandle}
                </p>
              </div>
              <Status value={a.status} />
            </div>
            <p>{a.description}</p>
            <dl className="facts">
              <div>
                <dt>Founder X</dt>
                <dd>@{a.xHandle}</dd>
              </div>
              <div>
                <dt>Project X</dt>
                <dd>
                  {a.projectXHandle ? `@${a.projectXHandle}` : "Not provided"}
                </dd>
              </div>
              <div>
                <dt>Country</dt>
                <dd>{a.country}</dd>
              </div>
              <div>
                <dt>Stage / sector</dt>
                <dd>
                  {a.stage} / {a.sector}
                </dd>
              </div>
              <div>
                <dt>Team / speakers</dt>
                <dd>
                  {a.teamSize} people / {a.speakers} speakers
                </dd>
              </div>
              <div>
                <dt>Main business focus</dt>
                <dd>{a.focus}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{a.contact || "Not provided"}</dd>
              </div>
              <div>
                <dt>Seeking</dt>
                <dd>{a.seeking || "Not provided"}</dd>
              </div>
              <div>
                <dt>Promotion consent</dt>
                <dd>
                  {a.promotionalConsent ? "Granted separately" : "Not granted"}
                </dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{niceDate(a.createdAt)}</dd>
              </div>
            </dl>
            <ExternalLink href={a.website}>Public project link</ExternalLink>
            {can && (
              <div className="form-actions">
                {["Declined", "Waitlisted", "Approved"].map((status) => (
                  <button
                    disabled={busy}
                    className={`button ${status === "Approved" ? "primary" : ""}`}
                    key={status}
                    onClick={() =>
                      void commit({
                        type: "application.review",
                        payload: { id: a.id, status },
                      })
                    }
                  >
                    {status === "Approved"
                      ? "Approve application"
                      : status === "Waitlisted"
                        ? "Waitlist"
                        : "Decline"}
                  </button>
                ))}
              </div>
            )}
            {a.status === "Approved" && (
              <div className="success-note">
                <p>
                  Founder and company records are linked. You can now assign a
                  session.
                </p>
                <button
                  className="button"
                  onClick={() => {
                    setSelected(null);
                    setBooking(true);
                  }}
                >
                  Assign session
                </button>
                <Link
                  className="text-link"
                  href={path("founders", a.founderId || "")}
                >
                  Open founder profile
                </Link>
                <Link
                  className="text-link"
                  href={path("companies", a.companyId || "")}
                >
                  Open company profile
                </Link>
              </div>
            )}
          </div>
        </Modal>
      )}
      {booking && (
        <BookingEditor sessionId={id} close={() => setBooking(false)} />
      )}
    </>
  );
}
