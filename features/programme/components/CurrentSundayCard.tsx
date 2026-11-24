"use client";

import Link from "next/link";
import { Check, Minus, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { currentSunday } from "@/features/spaces/lib/current-sunday";
import type { DataState } from "@/lib/types";

const londonDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  dateStyle: "full",
});

export default function CurrentSundayCard() {
  const { state, path } = useWorkspace();
  const [snapshot, setSnapshot] = useState<{
    base: DataState;
    data?: DataState;
    failed?: boolean;
    updatedAt?: string;
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
          setSnapshot({
            base: state,
            data: result.state,
            updatedAt: new Date().toISOString(),
          });
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

  const current =
    snapshot?.base === state && snapshot.data ? snapshot.data : state;
  const { startsAt, session, filled } = currentSunday(current, now);
  const failed = snapshot?.base === state && snapshot.failed;
  const remaining = session ? Math.max(0, session.capacity - filled) : 0;
  const projectIds = new Set(
    current.participants
      .filter(
        (p) => p.sessionId === session?.id && p.attendance !== "Cancelled",
      )
      .map((p) => p.companyId),
  );
  const projects = current.companies.filter((c) => projectIds.has(c.id));
  return (
    <section
      className="panel current-sunday"
      aria-labelledby="current-sunday-title"
    >
      <div className="current-sunday-heading">
        <div className="studio-space-date" aria-hidden="true">
          <b>
            {new Intl.DateTimeFormat("en-GB", {
              day: "2-digit",
              timeZone: "Europe/London",
            }).format(startsAt)}
          </b>
          <span>
            {new Intl.DateTimeFormat("en-GB", {
              month: "short",
              timeZone: "Europe/London",
            }).format(startsAt)}
          </span>
        </div>
        <div className="studio-space-heading-copy">
          <h2 id="current-sunday-title">Sunday Founder Space</h2>
          <p>{londonDate.format(startsAt)} · 7:00 PM UK</p>
        </div>
        {snapshot && !failed && session && session.status !== "Cancelled" && (
          <strong>
            {filled}
            <span>/{session.capacity}</span>
          </strong>
        )}
      </div>
      {!snapshot ? (
        <div
          className="current-sunday-skeleton"
          role="status"
          aria-label="Loading bookings"
        />
      ) : failed ? (
        <>
          <p role="alert">Could not load bookings for this Sunday.</p>
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
        <p>No Founder Space has been scheduled for this Sunday.</p>
      ) : (
        <>
          {session.status === "Cancelled" ? (
            <p>This Sunday’s Founder Space is cancelled.</p>
          ) : (
            <>
              <div className="current-sunday-slots" aria-hidden="true">
                {Array.from({ length: session.capacity }, (_, index) => (
                  <span key={index} className={index < filled ? "filled" : ""}>
                    {index < filled ? <Check size={20} /> : <Minus size={20} />}
                  </span>
                ))}
              </div>
              <p>
                {filled === 0
                  ? `No projects booked yet. ${session.capacity} project seats available.`
                  : remaining === 0
                    ? `All ${session.capacity} project seats are filled for this Sunday.`
                    : `${remaining} project ${remaining === 1 ? "seat remaining" : "seats remaining"}. Pending requests do not reserve a seat.`}
              </p>
            </>
          )}
          {!!projects.length && (
            <div className="studio-space-roster" aria-label="Approved projects">
              {projects.slice(0, 3).map((project) => (
                <Link key={project.id} href={path("companies", project.id)}>
                  {project.name}
                </Link>
              ))}
              {projects.length > 3 && (
                <Link href={path("spaces", session.id)}>
                  +{projects.length - 3} more
                </Link>
              )}
            </div>
          )}
          <div className="studio-space-footer">
            <Link
              className="button primary"
              href={`${path("spaces")}?tab=bookings&session=${encodeURIComponent(session.id)}`}
            >
              View Bookings <ArrowUpRight size={15} />
            </Link>
            {snapshot?.updatedAt && !failed && (
              <small>
                Updated{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(snapshot.updatedAt))}{" "}
                · refreshes every 30s
              </small>
            )}
          </div>
        </>
      )}
    </section>
  );
}
