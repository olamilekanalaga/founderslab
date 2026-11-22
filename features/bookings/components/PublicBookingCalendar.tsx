"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Mic2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { publicSlotOpen, type PublicSession } from "@/lib/dates/booking";
import SessionTime from "@/components/shared/SessionTime";

export default function PublicBookingCalendar({
  sessions,
  initialSelectedId = "",
}: {
  sessions: PublicSession[];
  initialSelectedId?: string;
}) {
  const weeks = sessions
    .slice(0, 8)
    .map((session) => ({
      session,
      open: publicSlotOpen(session, session.availableSeats),
    }));
  const [selected, setSelected] = useState(initialSelectedId);
  const chosen = weeks.find(
    (week) => week.session.id === selected && week.open,
  )?.session;
  const available = weeks.some((week) => week.open);
  const shortDate = (session: PublicSession) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "long",
    }).format(new Date(session.startsAt));
  return (
    <section
      className={`booking-weekly fl-booking-layout ${chosen ? "has-selection" : ""}`}
      aria-label="Founders Lab upcoming Spaces"
    >
      <div className="fl-date-panel">
        <div className="fl-date-panel-heading">
          <div>
            <h2>Upcoming Spaces</h2>
            <p>Every Saturday. 7 PM London.</p>
          </div>
          <span
            className={available ? "fl-slot-state is-open" : "fl-slot-state"}
          >
            {available
              ? "Booking open"
              : weeks.length
                ? "Booking closed"
                : "Not open yet"}
          </span>
        </div>
        <p className="fl-date-instruction">
          Choose an available Saturday to see your local time and continue.
        </p>
        {[weeks.slice(0, 4), weeks.slice(4, 8)].map(
          (group, index) =>
            group.length > 0 && (
              <div className="fl-date-group" key={index}>
                <div className="fl-date-group-label">
                  <span>
                    {index === 0
                      ? "Next four Saturdays"
                      : "Following four Saturdays"}
                  </span>
                  <span>Cycle {index + 1}</span>
                </div>
                <div className="weekly-dates">
                  {group.map(({ session, open }) => {
                    const date = new Date(session.startsAt);
                    const picked = chosen?.id === session.id;
                    const count =
                      session.availableSeats > 0
                        ? `${session.availableSeats} ${session.availableSeats === 1 ? "slot" : "slots"} left`
                        : "Full";
                    const state = session.submitted
                      ? "Attendance received"
                      : session.availableSeats <= 0
                        ? "Fully booked"
                        : open
                          ? "Available"
                          : "Closed";
                    return (
                      <button
                        type="button"
                        key={session.id}
                        className={`weekly-date ${picked ? "selected" : ""}`}
                        disabled={!open}
                        aria-pressed={picked}
                        aria-controls="fl-selected-summary"
                        aria-label={`${shortDate(session)} ${new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Europe/London" }).format(date)}, ${count}, ${state}`}
                        onClick={() => setSelected(session.id)}
                      >
                        <span className="fl-date-card-top">
                          <span className="fl-date-month">
                            {new Intl.DateTimeFormat("en-GB", {
                              month: "short",
                              timeZone: "Europe/London",
                            }).format(date)}{" "}
                            {new Intl.DateTimeFormat("en-GB", {
                              year: "numeric",
                              timeZone: "Europe/London",
                            }).format(date)}
                          </span>
                          <span className="fl-date-radio">
                            {picked && <Check size={12} aria-hidden="true" />}
                          </span>
                        </span>
                        <strong className="fl-date-number">
                          {new Intl.DateTimeFormat("en-GB", {
                            day: "numeric",
                            timeZone: "Europe/London",
                          }).format(date)}
                          <span>Saturday</span>
                        </strong>
                        <span className="fl-date-card-bottom">
                          <b>{count}</b>
                          <small>{state}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ),
        )}
        {!available && (
          <div className="calendar-empty-state fl-calendar-empty" role="status">
            <CalendarDays size={25} aria-hidden="true" />
            <div>
              <strong>
                {weeks.length
                  ? "No places available"
                  : "No Saturday slots published yet"}
              </strong>
              <p>
                {weeks.length
                  ? "No Saturday sessions are currently open. Please check back for the next available dates."
                  : "The next programme dates will appear here when they are published."}
              </p>
            </div>
          </div>
        )}
      </div>
      <aside
        className="fl-book-summary"
        id="fl-selected-summary"
        aria-label="Your selected conversation"
      >
        <div className="fl-summary-heading">
          <span>
            <Mic2 size={21} aria-hidden="true" />
          </span>
          <div>
            <strong>Your founder conversation</strong>
            <small>Hosted by ⭕️La_Crrypt💰₿</small>
          </div>
        </div>
        <div className="fl-summary-date" aria-live="polite">
          <span className="fl-summary-eyebrow">
            {chosen ? "Your selected Saturday" : "Your next conversation"}
          </span>
          <h3>{chosen ? shortDate(chosen) : "Start with a Saturday."}</h3>
          {chosen ? (
            <p>
              <SessionTime startsAt={chosen.startsAt} />
            </p>
          ) : (
            <p>
              Pick a date on the calendar.
              <br />
              We’ll show the details right here.
            </p>
          )}
        </div>
        <dl className="fl-summary-facts">
          <div>
            <dt>
              <Mic2 size={17} aria-hidden="true" /> Where
            </dt>
            <dd>Live on X Spaces</dd>
          </div>
          <div>
            <dt>
              <UsersIcon /> Format
            </dt>
            <dd>
              {chosen
                ? `${chosen.capacity} founder-project seats`
                : "Five founder-project seats"}
            </dd>
          </div>
          <div>
            <dt>
              <Clock3 size={17} aria-hidden="true" /> Cost
            </dt>
            <dd>Free participation</dd>
          </div>
          {chosen && (
            <div>
              <dt>
                <CalendarDays size={17} aria-hidden="true" /> Availability
              </dt>
              <dd>
                {chosen.availableSeats}{" "}
                {chosen.availableSeats === 1 ? "place" : "places"} left
              </dd>
            </div>
          )}
        </dl>
        {chosen ? (
          <div className="fl-book-action">
            <div className="fl-mobile-selected-date">
              <strong>{shortDate(chosen)}</strong>
              <span>7 PM London</span>
            </div>
            <Link
              className="weekly-continue fl-action fl-action-primary"
              href={`/apply?session=${encodeURIComponent(chosen.id)}`}
            >
              Continue to application{" "}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <button type="button" className="fl-next-disabled" disabled>
            Choose a date to continue{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        )}
        <div className="fl-summary-policy">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            Your request is reviewed before a place is confirmed. Pending
            applications don’t reserve a seat.
          </p>
        </div>
        <Link className="fl-summary-terms" href="/terms">
          Programme terms & privacy
        </Link>
      </aside>
    </section>
  );
}

function UsersIcon() {
  return <Users size={17} aria-hidden="true" />;
}
