"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { api } from "@/features/bookings/lib/public-api";
import { publicSlotOpen, type PublicSession } from "@/lib/dates/booking";
import SessionTime from "@/components/shared/SessionTime";

type Availability =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; sessions: PublicSession[] };
export default function UpcomingSpaces() {
  const [availability, setAvailability] = useState<Availability>({
    status: "loading",
  });
  useEffect(() => {
    let active = true;
    void api("sessions")
      .then(({ sessions }: { sessions: PublicSession[] }) => {
        if (active)
          setAvailability({
            status: "ready",
            sessions: sessions
              .filter((s) => Date.parse(s.startsAt) > Date.now())
              .slice(0, 3),
          });
      })
      .catch(() => {
        if (active) setAvailability({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);
  if (availability.status !== "ready")
    return (
      <p className="programme-availability-message" role="status">
        {availability.status === "loading"
          ? "Loading live availability…"
          : "Live availability is temporarily unavailable. Please check the booking calendar again shortly."}
      </p>
    );
  if (!availability.sessions.length)
    return (
      <p className="programme-availability-message" role="status">
        No upcoming Saturdays are currently published. Please check back for the
        next programme dates.
      </p>
    );
  return (
    <div className="programme-session-grid">
      {availability.sessions.map((session) => {
        const open = publicSlotOpen(session, session.availableSeats);
        const date = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(session.startsAt));
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
            <div className="programme-session-top">
              <CalendarDays size={20} aria-hidden="true" />
              <span
                className={
                  open
                    ? "programme-session-status is-open"
                    : "programme-session-status"
                }
              >
                {open
                  ? capacity
                  : session.availableSeats <= 0
                    ? "Full"
                    : "Closed"}
              </span>
            </div>
            <h3>{date}</h3>
            <p className="programme-session-time">
              <SessionTime startsAt={session.startsAt} />
            </p>
            <p>
              {capacity} · {session.capacity} project seats per Space
            </p>
            {open ? (
              <Link
                className="programme-session-link"
                href={`/apply?session=${encodeURIComponent(session.id)}`}
              >
                Request this Saturday{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            ) : (
              <span className="programme-session-closed">
                {session.submitted
                  ? "Attendance received"
                  : "Not available for booking"}
              </span>
            )}
          </article>
        );
      })}
    </div>
  );
}
