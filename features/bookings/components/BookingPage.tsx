"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, RefreshCw } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import PublicBookingCalendar from "@/features/bookings/components/PublicBookingCalendar";
import { type PublicSession } from "@/lib/dates/booking";
import { api } from "@/features/bookings/lib/public-api";
export function BookingPage({ configured }: { configured: boolean }) {
  const params = useSearchParams();
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void api("sessions")
      .then((result) => {
        if (active) {
          setSessions(result.sessions);
          setLoading(false);
          setError(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const retry = () => {
    setLoading(true);
    setError(false);
    setAttempt((value) => value + 1);
  };
  return (
    <div className="public-app fl-book-page">
      <PublicHeader />
      <main className="fl-book-main fl-container" id="main-content">
        <div className="fl-book-title">
          <span className="fl-eyebrow">
            <CalendarDays size={15} aria-hidden="true" /> Make room for a
            conversation
          </span>
          <h1>Choose your Saturday.</h1>
          <p>
            Bring your product and your perspective. We’ll bring the
            conversation.
          </p>
        </div>
        {!configured || error ? (
          <div className="fl-recovery-card" role="alert">
            <CalendarDays size={29} aria-hidden="true" />
            <h2>Booking is temporarily unavailable.</h2>
            <p>We couldn’t load the current dates. Please try again shortly.</p>
            <button
              type="button"
              className="fl-action fl-action-primary"
              onClick={retry}
            >
              <RefreshCw size={17} aria-hidden="true" /> Retry availability
            </button>
          </div>
        ) : loading ? (
          <div className="fl-book-loading" role="status">
            <div>
              {Array.from({ length: 8 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <aside />
            <p>Loading available Saturdays…</p>
          </div>
        ) : (
          <PublicBookingCalendar
            sessions={sessions}
            initialSelectedId={params.get("session") || ""}
          />
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
