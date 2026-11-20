"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ArrowUpRight,
  ArrowLeft,
  CalendarDays,
  Mic2,
  Pencil,
  Users,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import {
  Avatar,
  Status,
  SectionHeading,
  Modal,
  Empty,
  ExternalLink,
} from "./ui";
import { approvedSeats } from "@/lib/domain";
import { dateTime, niceDate } from "@/lib/selectors";
import { BOOKING_STATUSES } from "@/lib/catalog";
import type { Resource } from "./RecordEditor";
type Editor = (resource: Resource, record?: Record<string, unknown>) => void;
export default function Spaces({ id, edit }: { id?: string; edit: Editor }) {
  const { state: s, viewer, path, commit, busy, demo } = useWorkspace(),
    router = useRouter(),
    params = useSearchParams();
  const tab = params.get("tab") || "sessions";
  const [selected, setSelected] = useState<string | null>(null),
    [booking, setBooking] = useState(false),
    [filter, setFilter] = useState("All");
  const a = s.applications.find((v) => v.id === selected),
    can = viewer.permissions.includes("booking.write");
  const session = s.sessions.find((v) => v.id === id);
  return (
    <>
      {id && session ? (
        <>
          <Link className="back-link" href={path("spaces")}>
            <ArrowLeft size={16} /> All Spaces
          </Link>
          <div className="page-heading">
            <div>
              <div className="eyebrow">FOUNDER CONVERSATIONS</div>
              <h1>{session.title}</h1>
              <p>
                {dateTime(session.startsAt, session.timezone)} ·{" "}
                {session.timezone} · Hosted by {session.host}
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
          <div className="metric-grid three">
            <section className="metric-card">
              <div>
                Founder-project seats <Users size={18} />
              </div>
              <strong>
                {approvedSeats(s, session.id)} <span>/ {session.capacity}</span>
              </strong>
              <small>Each company occupies one seat</small>
            </section>
            <section className="metric-card">
              <div>
                Participating speakers <Mic2 size={18} />
              </div>
              <strong>
                {s.participants
                  .filter(
                    (p) => p.sessionId === id && p.attendance !== "Cancelled",
                  )
                  .reduce((n, p) => n + p.speakers, 0)}
              </strong>
              <small>Speakers are counted separately</small>
            </section>
            <section className="metric-card">
              <div>Research status</div>
              <strong className="metric-word">{session.researchStatus}</strong>
              <small>
                Deadline {dateTime(session.deadline, session.timezone)}
              </small>
            </section>
          </div>
          <section className="panel padded">
            <div className="row-between">
              <h2>Session links</h2>
              <Status value={session.status} />
            </div>
            <div className="inline">
              <ExternalLink href={session.liveUrl}>Live Space</ExternalLink>
              <ExternalLink href={session.recordingUrl}>
                {demo
                  ? "Shared recording · fictional placeholder"
                  : "Shared session recording"}
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
              title="Participating founders"
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
                    <th>Speakers</th>
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
              <div className="eyebrow">MEANINGFUL CONVERSATIONS</div>
              <h1>Founder Spaces</h1>
              <p>
                Bring the right people into the room. Keep the learning
                connected.
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
            <span className="muted">
              {tab === "sessions"
                ? "Default capacity: five founder projects, not five speakers."
                : tab === "bookings"
                  ? "Requests need approval; a pending request does not reserve a seat."
                  : "Founder-facing forms stay short. Research happens after approval."}
            </span>
          </div>
          {tab === "sessions" ? (
            <div className="session-grid">
              {[...s.sessions]
                .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
                .filter((v) => filter === "All" || v.status === filter)
                .map((session) => (
                  <article className="panel session-card" key={session.id}>
                    <div className="row-between">
                      <span className="session-icon">
                        <CalendarDays size={21} />
                      </span>
                      <Status value={session.status} />
                    </div>
                    <Link href={path("spaces", session.id)}>
                      <h2>{session.title}</h2>
                    </Link>
                    <p>
                      {dateTime(session.startsAt, session.timezone)}
                      <br />
                      {session.timezone} · {session.host}
                    </p>
                    <div className="session-capacity">
                      <span>
                        {approvedSeats(s, session.id)} / {session.capacity}{" "}
                        project seats
                      </span>
                      <span>{session.researchStatus}</span>
                    </div>
                    <div className="session-card-actions">
                      <Link
                        className="text-link"
                        href={path("spaces", session.id)}
                      >
                        View session <ArrowUpRight size={14} />
                      </Link>
                      {can && (
                        <button
                          className="icon-button"
                          aria-label={`Edit ${session.title}`}
                          onClick={() =>
                            edit(
                              "session",
                              session as unknown as Record<string, unknown>,
                            )
                          }
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          ) : tab === "applications" ? (
            <section className="panel">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Founder / company</th>
                      <th>Country</th>
                      <th>Team</th>
                      <th>Speakers</th>
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
                      <th>Session</th>
                      <th>Speakers</th>
                      <th>Booking status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.bookings
                      .filter((b) => filter === "All" || b.status === filter)
                      .map((b) => (
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
                {!s.bookings.length && <Empty>No bookings yet.</Empty>}
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
function BookingEditor({
  sessionId,
  close,
}: {
  sessionId?: string;
  close: () => void;
}) {
  const { state: s, commit, busy } = useWorkspace();
  const [applicationId, setApplication] = useState(
      s.applications.find((a) => a.status === "Approved")?.id || "",
    ),
    [selectedSession, setSession] = useState(
      sessionId || s.sessions.find((v) => v.status === "Scheduled")?.id || "",
    ),
    [speakers, setSpeakers] = useState(1);
  return (
    <Modal title="Create booking request" close={close}>
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await commit({
              type: "booking.create",
              payload: { applicationId, sessionId: selectedSession, speakers },
            })
          )
            close();
        }}
      >
        <label>
          Application / project
          <select
            required
            value={applicationId}
            onChange={(e) => {
              setApplication(e.target.value);
              setSpeakers(
                s.applications.find((a) => a.id === e.target.value)?.speakers ||
                  1,
              );
            }}
          >
            <option value="">Select application</option>
            {s.applications
              .filter((a) => a.status !== "Declined")
              .map((a) => (
                <option value={a.id} key={a.id}>
                  {a.companyName} · {a.reference}
                </option>
              ))}
          </select>
        </label>
        <label>
          Session
          <select
            required
            value={selectedSession}
            onChange={(e) => setSession(e.target.value)}
          >
            <option value="">Select session</option>
            {s.sessions
              .filter((v) => v.status === "Scheduled")
              .map((v) => (
                <option value={v.id} key={v.id}>
                  {v.title} · {v.capacity - approvedSeats(s, v.id)} project
                  seats free
                </option>
              ))}
          </select>
        </label>
        <label>
          Speakers representing this project
          <input
            type="number"
            min={1}
            max={10}
            required
            value={speakers}
            onChange={(e) => setSpeakers(Number(e.target.value))}
          />
        </label>
        <p className="form-note">
          This creates a pending request. Approval checks project capacity on
          the server in the private workspace.
        </p>
        <button disabled={busy} className="button primary" type="submit">
          Create pending booking
        </button>
      </form>
    </Modal>
  );
}
