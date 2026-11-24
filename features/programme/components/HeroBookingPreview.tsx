"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Mic2, RefreshCw } from "lucide-react";
import { isSunday, publicSlotOpen } from "@/lib/dates/booking";
import SessionTime from "@/components/shared/SessionTime";
import { useProgrammeAvailability } from "./ProgrammeAvailability";
export default function HeroBookingPreview() {
  const { availability, retry } = useProgrammeAvailability();
  const [selected, setSelected] = useState("");
  const upcoming = availability.sessions
    .filter(
      (session) =>
        isSunday(session) && Date.parse(session.startsAt) > availability.asOf,
    )
    .slice(0, 3);
  const chosen =
    upcoming.find((session) => session.id === selected) ||
    upcoming.find((session) => publicSlotOpen(session, session.availableSeats));
  return (
    <aside
      id="choose-a-sunday"
      className="fl-preview-wrap"
      aria-label="Live programme booking preview"
    >
      <span id="choose-a-saturday" aria-hidden="true" />
      <div className="fl-preview-card">
        <div className="fl-preview-heading">
          <span className="fl-preview-icon">
            <CalendarDays size={21} aria-hidden="true" />
          </span>
          <div>
            <strong>Your next conversation</strong>
            <span>Find your Sunday</span>
          </div>
          <span className="fl-free-label">Free</span>
        </div>
        <div className="fl-preview-dates" aria-label="Upcoming Sundays preview">
          {availability.status === "loading" ? (
            <div className="fl-preview-loading" role="status">
              <span />
              <span />
              <span />
              <p>Loading live availability…</p>
            </div>
          ) : availability.status === "error" ? (
            <div className="fl-preview-message" role="status">
              <CalendarDays size={28} aria-hidden="true" />
              <strong>Dates are temporarily unavailable</strong>
              <p>Please try again shortly.</p>
              <button type="button" onClick={retry}>
                <RefreshCw size={15} aria-hidden="true" /> Retry availability
              </button>
            </div>
          ) : !upcoming.length ? (
            <div className="fl-preview-message" role="status">
              <strong>The next conversation is on its way.</strong>
              <p>No upcoming Sundays are currently published.</p>
            </div>
          ) : (
            upcoming.map((session) => {
              const open = publicSlotOpen(session, session.availableSeats);
              const date = new Date(session.startsAt);
              return (
                <button
                  key={session.id}
                  type="button"
                  disabled={!open}
                  aria-pressed={chosen?.id === session.id}
                  className={chosen?.id === session.id ? "is-selected" : ""}
                  onClick={() => setSelected(session.id)}
                >
                  <span className="fl-preview-day">
                    <small>
                      {new Intl.DateTimeFormat("en-GB", {
                        timeZone: "Europe/London",
                        weekday: "short",
                      }).format(date)}
                    </small>
                    <strong>
                      {new Intl.DateTimeFormat("en-GB", {
                        timeZone: "Europe/London",
                        day: "numeric",
                      }).format(date)}
                    </strong>
                  </span>
                  <span className="fl-preview-date-copy">
                    <strong>
                      {new Intl.DateTimeFormat("en-GB", {
                        timeZone: "Europe/London",
                        month: "long",
                        year: "numeric",
                      }).format(date)}
                    </strong>
                    <small>
                      {open
                        ? `${session.availableSeats} ${session.availableSeats === 1 ? "slot" : "slots"} left`
                        : session.availableSeats <= 0
                          ? "Full"
                          : "Closed"}
                    </small>
                  </span>
                  <span className="fl-preview-radio">
                    {chosen?.id === session.id && (
                      <Check size={12} aria-hidden="true" />
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {chosen && (
          <div className="fl-preview-selected">
            <span className="fl-preview-session-label">
              <Mic2 size={15} aria-hidden="true" /> Live on X Spaces
            </span>
            <div className="fl-preview-time">
              <SessionTime startsAt={chosen.startsAt} />
            </div>
            <Link
              className="fl-action fl-action-primary"
              href={`/apply?session=${encodeURIComponent(chosen.id)}`}
            >
              Choose this Sunday <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        )}
        <div className="fl-preview-footnote">
          <Check size={14} aria-hidden="true" /> Places confirmed after
          application review
        </div>
      </div>
      <div className="fl-preview-caption">
        <Mic2 size={16} aria-hidden="true" />
        <span>A small group. A shared perspective.</span>
      </div>
    </aside>
  );
}
