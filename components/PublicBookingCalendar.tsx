"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";
import {
  isSaturday,
  publicSlotOpen,
  sessionDay,
  type PublicSession,
} from "@/lib/booking";
export default function PublicBookingCalendar({
  sessions,
  demo,
}: {
  sessions: PublicSession[];
  demo: boolean;
}) {
  const open = sessions.filter((s) => publicSlotOpen(s, s.availableSeats));
  const first = open.toSorted((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  )[0];
  const [month, setMonth] = useState(() =>
    (first ? sessionDay(first) : new Date().toISOString().slice(0, 10)).slice(
      0,
      7,
    ),
  );
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const date = new Date(`${month}-01T12:00:00Z`);
  const year = date.getUTCFullYear(),
    index = date.getUTCMonth();
  const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const offset = (date.getUTCDay() + 6) % 7;
  const selected = sessions.find((s) => s.id === slot);
  const today = new Date().toISOString().slice(0, 10);
  function move(delta: number) {
    setMonth(
      new Date(Date.UTC(year, index + delta, 1)).toISOString().slice(0, 7),
    );
    setDay("");
    setSlot("");
  }
  return (
    <section
      className="booking-calendar panel"
      aria-label="Choose your founder Space"
    >
      <aside className="booking-intro">
        <span className="booking-calendar-icon">
          <CalendarDays size={24} />
        </span>
        <span className="eyebrow">WITH OLA_CRRYPT</span>
        <h2>Founder Space</h2>
        <p>Choose a Saturday, then tell us about you and your project.</p>
        <div>
          <CalendarDays size={17} /> Saturdays
        </div>
        <div>
          <Clock3 size={17} /> Times shown in Africa/Lagos
        </div>
        <small>Bookings are reviewed by the programme team.</small>
      </aside>
      <div className="booking-month">
        <h2>Select a date</h2>
        <div className="booking-month-nav">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous month"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={20} />
          </button>
          <strong aria-live="polite">
            {date.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </strong>
          <button
            type="button"
            className="icon-button"
            aria-label="Next month"
            onClick={() => move(1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div
          className="booking-days"
          aria-label={date.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span className="booking-weekday" key={d}>
              {d}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span aria-hidden="true" key={`blank${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const key = `${month}-${String(i + 1).padStart(2, "0")}`;
            const slots = sessions.filter(
              (s) => sessionDay(s) === key && isSaturday(s),
            );
            const available = slots.some((s) =>
              publicSlotOpen(s, s.availableSeats),
            );
            const full =
              slots.length > 0 && slots.every((s) => s.availableSeats <= 0);
            const label = new Date(`${key}T12:00:00Z`).toLocaleDateString(
              "en-GB",
              {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              },
            );
            return (
              <button
                type="button"
                key={key}
                disabled={!available}
                aria-label={`${label}${full ? ", full" : !available ? ", unavailable" : ""}`}
                aria-pressed={day === key}
                aria-current={key === today ? "date" : undefined}
                className={`${available ? "available" : ""} ${day === key ? "selected" : ""}`}
                onClick={() => {
                  setDay(key);
                  setSlot("");
                }}
              >
                {i + 1}
                {full && <small>Full</small>}
              </button>
            );
          })}
        </div>
        <div className="booking-calendar-key">
          <span /> Available Saturday <span className="unavailable" />{" "}
          Unavailable
        </div>
      </div>
      <div className="booking-times" aria-live="polite">
        <h2>
          {day
            ? new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              })
            : "Select a Saturday"}
        </h2>
        {!day ? (
          <p>
            {open.length
              ? "Available times will appear here."
              : "No Saturdays are currently open. Please check back soon."}
          </p>
        ) : (
          <>
            <span className="booking-timezone">Africa/Lagos</span>
            <div className="booking-time-options">
              {sessions
                .filter((s) => sessionDay(s) === day && isSaturday(s))
                .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))
                .map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    className={`booking-time ${slot === s.id ? "selected" : ""}`}
                    disabled={!publicSlotOpen(s, s.availableSeats)}
                    aria-pressed={slot === s.id}
                    onClick={() => setSlot(s.id)}
                  >
                    <strong>
                      {new Date(s.startsAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Africa/Lagos",
                      })}
                    </strong>
                    <span>
                      {s.availableSeats <= 0
                        ? "Full"
                        : `${s.availableSeats} project places available`}
                    </span>
                  </button>
                ))}
            </div>
            {selected && publicSlotOpen(selected, selected.availableSeats) && (
              <div className="booking-selected">
                <p>{selected.title}</p>
                <Link
                  className="button primary full-width"
                  href={`/apply?session=${encodeURIComponent(selected.id)}${demo ? "&mode=demo" : ""}`}
                >
                  Continue <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
