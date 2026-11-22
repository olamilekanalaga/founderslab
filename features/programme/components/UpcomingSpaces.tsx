"use client";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { publicSlotOpen } from "@/lib/dates/booking";
import SessionTime from "@/components/shared/SessionTime";
import { useProgrammeAvailability } from "./ProgrammeAvailability";
export default function UpcomingSpaces() {
  const { availability, retry } = useProgrammeAvailability();
  if (availability.status === "loading")
    return (
      <div className="fl-session-skeleton" role="status">
        <span />
        <span />
        <span />
        <p>Loading live availability…</p>
      </div>
    );
  if (availability.status === "error")
    return (
      <div className="programme-availability-message" role="status">
        <p>
          Live availability is temporarily unavailable. Please check the booking
          calendar again shortly.
        </p>
        <button type="button" className="fl-inline-action" onClick={retry}>
          <RefreshCw size={15} aria-hidden="true" /> Retry availability
        </button>
      </div>
    );
  const upcoming = availability.sessions
    .filter((session) => Date.parse(session.startsAt) > availability.asOf)
    .slice(0, 3);
  if (!upcoming.length)
    return (
      <p className="programme-availability-message" role="status">
        No upcoming Saturdays are currently published. Please check back for the
        next programme dates.
      </p>
    );
  return (
    <div className="fl-upcoming-grid">
      {upcoming.map((session) => {
        const date = new Date(session.startsAt);
        const open = publicSlotOpen(session, session.availableSeats);
        const capacity =
          session.availableSeats > 0
            ? `${session.availableSeats} ${session.availableSeats === 1 ? "slot" : "slots"} left`
            : "Full";
        return (
          <article
            className="programme-session-card"
            key={session.id}
            data-session-id={session.id}
          >
            <div className="fl-session-top">
              <span>
                {new Intl.DateTimeFormat("en-GB", {
                  weekday: "long",
                  timeZone: "Europe/London",
                }).format(date)}
              </span>
              <span
                className={open ? "fl-slot-state is-open" : "fl-slot-state"}
              >
                {open
                  ? capacity
                  : session.availableSeats <= 0
                    ? "Full"
                    : "Closed"}
              </span>
            </div>
            <h3>
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "long",
                timeZone: "Europe/London",
              }).format(date)}
            </h3>
            <p className="fl-session-time">
              <SessionTime startsAt={session.startsAt} />
            </p>
            <div className="fl-session-bottom">
              <small>{session.capacity} project seats per Space</small>
              {open ? (
                <Link
                  href={`/apply?session=${encodeURIComponent(session.id)}`}
                  aria-label={`Request ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" }).format(date)}`}
                >
                  <ArrowUpRight size={22} aria-hidden="true" />
                </Link>
              ) : (
                <span>
                  {session.submitted
                    ? "Attendance received"
                    : "Not available for booking"}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
