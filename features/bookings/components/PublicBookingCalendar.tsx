"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  BOOKING_TIME_LABEL,
  publicSlotOpen,
  type PublicSession,
} from "@/lib/dates/booking";
import SessionTime from "@/components/shared/SessionTime";
export default function PublicBookingCalendar({
  sessions,
}: {
  sessions: PublicSession[];
}) {
  const weeks = sessions.slice(0, 8).map((session, index) => ({
    date: new Date(session.startsAt),
    index,
    session,
    open: publicSlotOpen(session, session.availableSeats),
  }));
  const [selected, setSelected] = useState("");
  const chosen = weeks.find((w) => w.session?.id === selected);
  const available = weeks.some((w) => w.open);
  const published = weeks.some((w) => !!w.session);
  const shortDate = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    });
  return (
    <section
      className="booking-weekly panel"
      aria-label="Founders Lab upcoming Spaces"
    >
      <div className="weekly-heading">
        <div>
          <h2>Upcoming Spaces</h2>
          <p>Saturday · 7:00 PM London · Two four-week cycles</p>
        </div>
        <span className={`weekly-status ${available ? "is-open" : ""}`}>
          {available
            ? "Booking open"
            : published
              ? "Booking closed"
              : "Not open yet"}
        </span>
      </div>
      <p className="weekly-location">{BOOKING_TIME_LABEL}</p>
      <div className="weekly-dates" aria-label="Current season Saturdays">
        {weeks.map((w) => {
          const full = !!w.session && w.session.availableSeats <= 0;
          const count =
            w.session.availableSeats > 0
              ? `${w.session.availableSeats} ${w.session.availableSeats === 1 ? "slot" : "slots"} left`
              : "Full";
          const state = w.session.submitted
            ? "Attendance received"
            : full
              ? "Fully booked"
              : w.open
                ? "Available"
                : "Closed";
          const longDate = w.date.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Europe/London",
          });
          return (
            <button
              type="button"
              key={w.date.toISOString()}
              disabled={!w.open}
              aria-pressed={selected === w.session?.id}
              aria-label={`Week ${w.index + 1} ${shortDate(w.date)} ${count} ${state}. ${longDate}`}
              className={`weekly-date ${selected === w.session?.id ? "selected" : ""}`}
              onClick={() => setSelected(w.session!.id)}
            >
              <strong>{shortDate(w.date)}</strong> <b>{count}</b>{" "}
              <small>{state}</small>
            </button>
          );
        })}
      </div>
      {chosen?.session && chosen.open ? (
        <div className="weekly-selection">
          <div className="weekly-selection-heading">
            <h3>{shortDate(chosen.date)}</h3>
            <span className="weekly-status is-open">Open</span>
          </div>
          <p>
            {chosen.session.capacity - chosen.session.availableSeats} confirmed
            founder projects · {chosen.session.availableSeats} places available
          </p>
          <p className="weekly-selection-time">
            <SessionTime startsAt={chosen.session.startsAt} />
          </p>
          <Link
            className="weekly-continue"
            href={`/apply?session=${encodeURIComponent(chosen.session.id)}`}
          >
            View booking details <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="weekly-selection">
          <p>
            {available
              ? "Select a week to see booking details."
              : "No Saturday sessions are currently open."}
          </p>
        </div>
      )}
      {!available && (
        <div className="calendar-empty-state" role="status">
          <strong>
            {published
              ? "No places available"
              : "No Saturday slots published yet"}
          </strong>
          <p>
            Sessions must be published before founders can book. Fully booked
            weeks show Full and are disabled.
          </p>
          <Link className="text-link" href="/signin">
            Host sign in
          </Link>
        </div>
      )}
    </section>
  );
}
