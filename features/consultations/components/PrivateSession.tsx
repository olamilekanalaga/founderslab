"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import {
  businessDiscoverySchema,
  readDiscovery,
} from "@/lib/business-research";
import { consultationTime, gbp } from "@/lib/consultations";
import {
  DiscoveryFields,
  ResearchConsent,
} from "@/features/bookings/components/DiscoveryFields";
import { subscribeBrowser } from "@/features/bookings/lib/confirmation-store";
import { api } from "@/features/bookings/lib/public-api";

const checkoutStorage = "founderslab-private-session";
type Slot = { id: string; startsAt: string; endsAt: string };
type Appointment = {
  id: string;
  bookingStatus: string;
  paymentStatus: string;
  feePence: number;
  slot: Pick<Slot, "startsAt" | "endsAt">;
};
type BookingView = {
  settings: { feePence: number } | null;
  appointment: Appointment | null;
  slots: Slot[];
  checkout: boolean;
};

function readInvite() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.has("token")) return fragment.get("token") || "";
  if (new URLSearchParams(location.search).get("checkout") === "return") {
    try {
      return sessionStorage.getItem(checkoutStorage) || "";
    } catch {
      return "";
    }
  }
  return "";
}

function duration(slot: Pick<Slot, "startsAt" | "endsAt">) {
  return Math.round(
    (Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000,
  );
}

export default function PrivateSession() {
  const token = useSyncExternalStore(subscribeBrowser, readInvite, () => null);
  const [lookup, setLookup] = useState<{
    token: string;
    view?: BookingView;
    error?: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [slotId, setSlotId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const view = lookup?.token === token ? lookup?.view : undefined;

  useEffect(() => {
    if (!token) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const returning =
      new URLSearchParams(location.search).get("checkout") === "return";
    async function load(attempt = 0) {
      try {
        const result: BookingView = await api("private-session", {
          action: "open",
          token,
        });
        if (!active) return;
        setLookup({ token: token!, view: result });
        if (
          returning &&
          result.appointment?.bookingStatus === "Reserved" &&
          attempt < 8
        )
          timer = setTimeout(() => void load(attempt + 1), 1500);
      } catch (error) {
        if (active)
          setLookup({
            token: token!,
            error:
              error instanceof Error
                ? error.message
                : "Could not open this link.",
          });
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token, refresh]);

  async function pay() {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      try {
        sessionStorage.setItem(checkoutStorage, token);
      } catch {
        // The original private link can also reopen the appointment.
      }
      const result = await api("private-session", {
        action: "checkout",
        token,
      });
      location.assign(result.checkout);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not open checkout.",
      );
      setBusy(false);
    }
  }

  const appointment = view?.appointment;
  const slot = view?.slots.find((item) => item.id === slotId);
  const lookupError = lookup?.token === token ? lookup?.error : "";
  return (
    <div className="public-app">
      <PublicHeader />
      <main
        className="public-form-page founder-application-page"
        id="main-content"
      >
        <section className="panel founder-application-card">
          <header className="founder-application-heading">
            <h1>{view ? "Private Business Session" : "Private booking"}</h1>
            {view && (
              <p>
                A confidential consultation to examine a business challenge, look
                at the evidence and develop practical recommendations.
              </p>
            )}
          </header>
          {token === "" ? (
            <p role="alert" className="error">
              Open the private link shared by the Founders Lab team.
            </p>
          ) : lookupError ? (
            <p role="alert" className="error">
              {lookupError}
            </p>
          ) : !view ? (
            <p role="status">Checking availability…</p>
          ) : appointment ? (
            <div className="public-form">
              <h2>
                {appointment.bookingStatus === "Confirmed"
                  ? "Appointment confirmed"
                  : appointment.bookingStatus === "Completed"
                    ? "Session completed"
                    : "Appointment reserved"}
              </h2>
              <p>
                {consultationTime(appointment.slot.startsAt)} · UK time ·{" "}
                {duration(appointment.slot)} minutes
              </p>
              <p>
                {gbp(appointment.feePence)} ·{" "}
                {appointment.paymentStatus === "Paid"
                  ? "Payment received"
                  : "Awaiting payment"}
              </p>
              {appointment.bookingStatus === "Reserved" && (
                <>
                  <p>
                    {view.checkout
                      ? "Your appointment is confirmed after payment. Use this link to check its status."
                      : "The team will arrange payment and confirm your appointment. Use this link to check its status."}
                  </p>
                  {view.checkout && (
                    <button
                      className="button primary full-width"
                      disabled={busy}
                      onClick={() => void pay()}
                    >
                      {busy ? "Opening checkout…" : "Pay securely"}
                    </button>
                  )}
                  <button
                    className="button full-width"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setRefresh((value) => value + 1);
                    }}
                  >
                    Refresh status
                  </button>
                </>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : !view.settings || !view.slots.length ? (
            <p role="status">
              No appointments are available right now. Check this link again
              after the team adds times.
            </p>
          ) : (
            <form
              className="public-form"
              noValidate
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy || !token || !view.settings) return;
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
                if (!slotId) fields.slotId = "Choose an appointment.";
                if (
                  !form.querySelector<HTMLInputElement>("[name=email]")
                    ?.validity.valid
                )
                  fields.email = "Enter a valid email address.";
                setIssues(fields);
                setError("");
                if (Object.keys(fields).length || !parsed.success) {
                  form
                    .querySelector<HTMLElement>(
                      `[name="${Object.keys(fields)[0]}"]`,
                    )
                    ?.focus();
                  return;
                }
                setBusy(true);
                try {
                  const result = await api("private-session", {
                    action: "reserve",
                    token,
                    slotId,
                    email,
                    feePence: view.settings.feePence,
                    discovery: parsed.data,
                  });
                  setLookup({ token, view: { ...view, ...result } });
                  window.scrollTo(0, 0);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Could not reserve this appointment.",
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
                    {view.slots.map((item) => (
                      <option value={item.id} key={item.id}>
                        {consultationTime(item.startsAt)} · {duration(item)} min
                      </option>
                    ))}
                  </select>
                  {issues.slotId && (
                    <small className="application-field-error">
                      {issues.slotId}
                    </small>
                  )}
                </label>
                <p className="span-2">
                  <strong>{gbp(view.settings.feePence)}</strong>
                  {slot && ` · ${duration(slot)} minutes`}
                </p>
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
                    <small className="application-field-error">
                      {issues.email}
                    </small>
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
                  Share enough for us to prepare. Leave out confidential
                  financial figures, credentials and customer data.
                </p>
                <ResearchConsent errors={issues} />
              </div>
              {Object.keys(issues).length > 0 && (
                <p className="error" role="alert">
                  Check the highlighted fields.
                </p>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary full-width" disabled={busy}>
                {busy ? "Reserving…" : "Reserve appointment"}
              </button>
            </form>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
