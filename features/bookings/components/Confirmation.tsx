"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import SessionTime from "@/components/shared/SessionTime";

import { Status } from "@/components/ui";
import PublicFooter from "@/components/layout/PublicFooter";
import { api } from "@/features/bookings/lib/public-api";
import {
  subscribeBrowser,
  noopSubscribe,
} from "@/features/bookings/lib/confirmation-store";
interface ConfirmationData {
  reference: string;
  companyName: string;
  status: string;
  bookings: {
    status: string;
    session: { title: string; startsAt: string; timezone: string };
  }[];
}
export function Confirmation() {
  const fragment = useSyncExternalStore(
    subscribeBrowser,
    () => window.location.hash,
    () => "",
  );
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const raw = new URLSearchParams(fragment.slice(1)).get("token");
  const [remote, setRemote] = useState<{
    token: string;
    data?: ConfirmationData;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (raw)
      void api("confirmation", { token: raw })
        .then((data) => {
          if (!cancelled) setRemote({ token: raw, data });
        })
        .catch((e) => {
          if (!cancelled) setRemote({ token: raw, error: e.message });
        });
    return () => {
      cancelled = true;
    };
  }, [raw]);
  const data = raw && remote?.token === raw ? remote.data || null : null;
  const error = !mounted
    ? ""
    : raw && remote?.token === raw
      ? remote.error || ""
      : !raw
        ? "Open the private confirmation link you received after applying. A reference alone does not grant access."
        : "";
  return (
    <div className="public-app">
      <PublicHeader />
      <main className="confirmation-page" id="main-content">
        {error ? (
          <div className="panel padded">
            <h1>Confirmation unavailable</h1>
            <p role="alert">{error}</p>
            <Link className="button" href="/apply">
              Founder application
            </Link>
          </div>
        ) : data ? (
          <div className="panel confirmation-card">
            <span className="confirmation-check">
              <CheckCircle2 size={34} />
            </span>
            <div className="eyebrow">APPLICATION RECEIVED</div>
            <h1>You’re on our radar.</h1>
            <p>
              Thank you for telling us about <b>{data.companyName}</b>.
            </p>
            <dl className="facts">
              <div>
                <dt>Application reference</dt>
                <dd>{data.reference}</dd>
              </div>
              <div>
                <dt>Application status</dt>
                <dd>
                  <Status value={data.status} />
                </dd>
              </div>
            </dl>
            {data.bookings.map((b, i) => (
              <div className="confirmation-booking" key={i}>
                <h3>{b.session.title}</h3>
                <p>
                  <SessionTime startsAt={b.session.startsAt} />
                </p>
                <Status value={b.status} />
              </div>
            ))}
            <h2>What happens next?</h2>
            <p>
              The programme team reviews applications and booking requests. A
              pending request does not reserve a seat. Save this private link to
              check your status; do not share it publicly.
            </p>
            <Link className="button primary" href="/book">
              Explore session requests <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <p role="status">Retrieving your confirmation…</p>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
