"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import {
  businessDiscoverySchema,
  readDiscovery,
} from "@/lib/business-research";
import {
  consultationTime,
  privateSessionRequestSchema,
} from "@/lib/consultations";
import {
  DiscoveryFields,
  ResearchConsent,
} from "@/features/bookings/components/DiscoveryFields";
import { subscribeBrowser } from "@/features/bookings/lib/confirmation-store";
import { api } from "@/features/bookings/lib/public-api";

type SessionTime = { startsAt: string; endsAt: string };
type Slot = SessionTime & { id: string };
type Appointment = { id: string; bookingStatus: string; slot: SessionTime };
type BookingView = { appointment: Appointment | null; slots: Slot[] };

function readInvite() {
  return new URLSearchParams(location.hash.slice(1)).get("token") ?? "";
}

function duration(slot: SessionTime) {
  return Math.round(
    (Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000,
  );
}

export default function PrivateSession() {
  const token = useSyncExternalStore(subscribeBrowser, readInvite, () => null);

  return (
    <div className="public-app">
      <PublicHeader />
      <main
        className="public-form-page founder-application-page"
        id="main-content"
      >
        <section className="panel founder-application-card">
          <header className="founder-application-heading">
            <h1>
              {token === "" ? "Request a private session" : "Private session"}
            </h1>
            <p>
              A free, confidential conversation to explore a business challenge
              and ways we might work together.
            </p>
          </header>
          {token === null ? (
            <p role="status">Loading…</p>
          ) : token === "" ? (
            <PrivateSessionRequest />
          ) : (
            <InvitedBooking key={token} token={token} />
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function PrivateSessionRequest() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (sent)
    return (
      <div role="status">
        <h2>Request received</h2>
        <p>
          We’ll review your request and get in touch if we can arrange a
          session.
        </p>
      </div>
    );
  return (
    <form
      className="public-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const parsed = privateSessionRequestSchema.safeParse(
          Object.fromEntries(new FormData(event.currentTarget)),
        );
        if (!parsed.success) {
          setError(
            "Enter your name, project, a valid email address and what you’d like to discuss.",
          );
          return;
        }
        setBusy(true);
        setError("");
        try {
          await api("private-session", { action: "request", ...parsed.data });
          setSent(true);
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not send your request.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Tell us what you’d like to discuss. Leave out confidential figures,
        credentials and customer data.
      </p>
      <div className="record-form">
        <label>
          Founder name
          <input
            name="founderName"
            autoComplete="name"
            required
            maxLength={180}
          />
        </label>
        <label>
          Project name
          <input
            name="businessName"
            autoComplete="organization"
            required
            maxLength={180}
          />
        </label>
        <label className="span-2">
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label className="span-2">
          What would you like to discuss?
          <textarea name="context" rows={4} required maxLength={2_000} />
        </label>
      </div>
      <p>
        The FoundersLab team uses these details to review and respond to your
        request.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full-width" disabled={busy}>
        {busy ? "Sending…" : "Send session request"}
      </button>
    </form>
  );
}

function InvitedBooking({ token }: { token: string }) {
  const [view, setView] = useState<BookingView>();
  const [busy, setBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [slotId, setSlotId] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void api("private-session", { action: "open", token })
      .then((result: BookingView) => {
        if (active) setView(result);
      })
      .catch((error) => {
        if (active)
          setLookupError(
            error instanceof Error
              ? error.message
              : "Could not open this invitation.",
          );
      });
    return () => {
      active = false;
    };
  }, [token, refresh]);

  if (lookupError)
    return (
      <p className="error" role="alert">
        {lookupError}
      </p>
    );
  if (!view) return <p role="status">Checking availability…</p>;
  if (view.appointment) {
    const { appointment } = view;
    const completed = appointment.bookingStatus === "Completed";
    return (
      <div role="status">
        <h2>{completed ? "Session completed" : "Appointment confirmed"}</h2>
        <p>
          {consultationTime(appointment.slot.startsAt)} · UK time ·{" "}
          {duration(appointment.slot)} minutes
        </p>
        {!completed && (
          <p>Keep this link to revisit your appointment details.</p>
        )}
      </div>
    );
  }
  if (!view.slots.length)
    return (
      <p role="status">
        No appointments are available right now. Check this invitation again for
        new times.
      </p>
    );

  return (
    <form
      className="public-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const values = new FormData(form);
        const email = String(values.get("email") || "").trim();
        const parsed = businessDiscoverySchema.safeParse({
          ...readDiscovery(values),
          businessDescription: values.get("businessDescription"),
        });
        const fields = parsed.success
          ? {}
          : Object.fromEntries(
              parsed.error.issues.map((issue) => [
                String(issue.path[0]),
                issue.message,
              ]),
            );
        if (!slotId || !view.slots.some(({ id }) => id === slotId))
          fields.slotId = "Choose an available appointment.";
        if (
          !form.querySelector<HTMLInputElement>("[name=email]")?.validity.valid
        )
          fields.email = "Enter a valid email address.";
        setIssues(fields);
        setError("");
        if (Object.keys(fields).length || !parsed.success) {
          form
            .querySelector<HTMLElement>(`[name="${Object.keys(fields)[0]}"]`)
            ?.focus();
          return;
        }
        setBusy(true);
        try {
          const result: { appointment: Appointment } = await api(
            "private-session",
            {
              action: "reserve",
              token,
              slotId,
              email,
              discovery: parsed.data,
            },
          );
          setView({ appointment: result.appointment, slots: [] });
          window.scrollTo(0, 0);
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not book this appointment.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="record-form">
        <label className="span-2">
          Appointment (UK time)
          <select
            name="slotId"
            required
            value={slotId}
            onChange={(event) => setSlotId(event.target.value)}
            aria-invalid={Boolean(issues.slotId)}
          >
            <option value="">Choose a time</option>
            {view.slots.map((slot) => (
              <option value={slot.id} key={slot.id}>
                {consultationTime(slot.startsAt)} · {duration(slot)} min
              </option>
            ))}
          </select>
          {issues.slotId && (
            <small className="application-field-error">{issues.slotId}</small>
          )}
        </label>
        <label className="span-2">
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            aria-invalid={Boolean(issues.email)}
          />
          {issues.email && (
            <small className="application-field-error">{issues.email}</small>
          )}
        </label>
        <label className="span-2">
          What are you building?
          <textarea
            name="businessDescription"
            rows={3}
            maxLength={5_000}
            required
            aria-invalid={Boolean(issues.businessDescription)}
          />
          {issues.businessDescription && (
            <small className="application-field-error">
              {issues.businessDescription}
            </small>
          )}
        </label>
      </div>
      <DiscoveryFields
        errors={issues}
        challengeLabel="What is the main business challenge you want to investigate?"
      />
      <div className="privacy-notice">
        <h2>Confidential review</h2>
        <p>
          Share enough for us to prepare. Leave out confidential financial
          figures, credentials and customer data.
        </p>
        <ResearchConsent errors={issues} />
      </div>
      {Object.keys(issues).length > 0 && (
        <p className="error" role="alert">
          Check the highlighted fields.
        </p>
      )}
      {error && (
        <>
          <p className="error" role="alert">
            {error}
          </p>
          <button
            className="button full-width"
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              setSlotId("");
              setRefresh((count) => count + 1);
            }}
          >
            Refresh available times
          </button>
        </>
      )}
      <button className="button primary full-width" disabled={busy}>
        {busy ? "Booking…" : "Confirm appointment"}
      </button>
    </form>
  );
}
