"use client";

import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { currentSaturday } from "@/features/spaces/lib/current-saturday";
import type { DataState } from "@/lib/types";

const londonDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  dateStyle: "full",
});

export default function CurrentSaturdayCard() {
  const { state, path } = useWorkspace();
  const [snapshot, setSnapshot] = useState<{
    base: DataState;
    data?: DataState;
    failed?: boolean;
  }>();
  const [now, setNow] = useState(() => new Date());
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      setNow(new Date());
      if (pending || document.hidden) return;
      pending = true;
      try {
        const response = await fetch("/api/workspace", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to load bookings");
        const result = await response.json();
        if (!controller.signal.aborted)
          setSnapshot({ base: state, data: result.state });
      } catch {
        if (!controller.signal.aborted)
          setSnapshot({ base: state, failed: true });
      } finally {
        pending = false;
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [state, retry]);

  const { startsAt, session, filled } = currentSaturday(
    snapshot?.base === state && snapshot.data ? snapshot.data : state,
    now,
  );
  const failed = snapshot?.base === state && snapshot.failed;
  const remaining = session ? Math.max(0, session.capacity - filled) : 0;
  return (
    <section
      className="panel current-saturday"
      aria-labelledby="current-saturday-title"
    >
      <div className="current-saturday-heading">
        <div>
          <h2 id="current-saturday-title">Saturday Founder Space</h2>
          <p>{londonDate.format(startsAt)} · 7:00 PM UK</p>
        </div>
        {snapshot && !failed && session && session.status !== "Cancelled" && (
          <strong>
            {filled}/{session.capacity} filled
          </strong>
        )}
      </div>
      {!snapshot ? (
        <div
          className="current-saturday-skeleton"
          role="status"
          aria-label="Loading bookings"
        />
      ) : failed ? (
        <>
          <p role="alert">Could not load bookings for this Saturday.</p>
          <button
            className="button"
            onClick={() => {
              setSnapshot(undefined);
              setRetry((value) => value + 1);
            }}
          >
            Retry
          </button>
        </>
      ) : !session ? (
        <p>No Founder Space has been scheduled for this Saturday.</p>
      ) : (
        <>
          {session.status === "Cancelled" ? (
            <p>This Saturday’s Founder Space is cancelled.</p>
          ) : (
            <>
              <div className="current-saturday-slots" aria-hidden="true">
                {Array.from({ length: session.capacity }, (_, index) => (
                  <span key={index} className={index < filled ? "filled" : ""}>
                    {index < filled ? <Check size={20} /> : <Minus size={20} />}
                  </span>
                ))}
              </div>
              <p>
                {filled === 0
                  ? `No founders booked yet. ${session.capacity} slots available.`
                  : remaining === 0
                    ? `All ${session.capacity} founder slots are filled for this Saturday.`
                    : `Only ${remaining} founder ${remaining === 1 ? "place remaining" : "places remaining"}.`}
              </p>
            </>
          )}
          <Link
            className="button"
            href={`${path("spaces")}?tab=bookings&session=${encodeURIComponent(session.id)}`}
          >
            View Bookings
          </Link>
        </>
      )}
    </section>
  );
}
