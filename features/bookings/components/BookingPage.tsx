"use client";
import { useEffect, useState } from "react";

import PublicHeader from "@/components/layout/PublicHeader";

import PublicBookingCalendar from "@/features/bookings/components/PublicBookingCalendar";
import { type PublicSession } from "@/lib/dates/booking";

import PublicFooter from "@/components/layout/PublicFooter";
import { api } from "@/features/bookings/lib/public-api";
export function BookingPage({ configured }: { configured: boolean }) {
  const [sessions, setSessions] = useState<PublicSession[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api("sessions")
      .then((r) => {
        if (active) {
          setSessions(r.sessions);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="public-app">
      <PublicHeader />
      <main className="public-form-page booking-page" id="main-content">
        <div className="booking-page-heading">
          <div>
            <span className="eyebrow">BOOK YOUR CONVERSATION</span>
            <h1>Founders Lab</h1>
          </div>
        </div>
        {!configured ? (
          <p role="alert">Booking is temporarily unavailable.</p>
        ) : error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : loading ? (
          <p role="status">Loading available Saturdays…</p>
        ) : (
          <PublicBookingCalendar sessions={sessions} />
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
