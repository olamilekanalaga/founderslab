"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import SessionTime from "@/components/shared/SessionTime";

import { publicSlotOpen, type PublicSession } from "@/lib/dates/booking";
import { COUNTRIES, SECTORS, STAGES, TEAM_SIZES } from "@/lib/catalog";
import { formError } from "@/lib/validation/form-errors";
import { applicationSchema } from "@/lib/validation/application";

import PublicFooter from "@/components/layout/PublicFooter";
import { api } from "@/features/bookings/lib/public-api";
export function ApplicationForm({ configured }: { configured: boolean }) {
  const params = useSearchParams(),
    router = useRouter();
  const selectedSessionId = params.get("session") || "";
  const [availableSessions, setAvailableSessions] = useState<PublicSession[]>(
    [],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [speakers, setSpeakers] = useState("1"),
    [other, setOther] = useState(4),
    [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({
    founderName: "",
    companyName: "",
    xHandle: "",
    website: "",
    country: "Nigeria",
    description: "",
    teamSize: "2–5",
    stage: "MVP",
    sector: "Payments",
    focus: "",
    founderRole: "Founder",
    contact: "",
    teamCountries: "",
    ecosystem: "",
    seeking: "",
    comments: "",
    websiteTrap: "",
  });
  const [privacy, setPrivacy] = useState(false),
    [promo, setPromo] = useState(false),
    [hiring, setHiring] = useState(false);
  const [catalog, setCatalog] = useState({
    countries: COUNTRIES,
    sectors: SECTORS,
    stages: STAGES,
  });
  useEffect(() => {
    void api("programme")
      .then((r) => {
        const labels = r.labels as { group: string; name: string }[];
        setCatalog({
          countries: r.settings.countryOptions || COUNTRIES,
          sectors: labels
            .filter((l) => l.group === "Sector")
            .map((l) => l.name),
          stages: labels
            .filter((l) => l.group === "Product stage")
            .map((l) => l.name),
        });
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (selectedSessionId)
      void api("sessions")
        .then((r) => setAvailableSessions(r.sessions))
        .catch(() =>
          setError(
            "Could not load your selected Space. Return to the calendar and try again.",
          ),
        );
  }, [selectedSessionId]);
  const chosenSession = availableSessions.find(
    (s) => s.id === selectedSessionId,
  );
  const selectionValid =
    !selectedSessionId ||
    Boolean(
      chosenSession &&
      publicSlotOpen(chosenSession, chosenSession.availableSeats),
    );
  const countries = catalog.countries,
    sectors = catalog.sectors,
    stages = catalog.stages;
  const change = (key: string, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));
  return (
    <div className="public-app">
      <PublicHeader />
      <main className="public-form-page" id="main-content">
        <h1>Bring your founder story.</h1>
        {!configured && (
          <p role="alert">Applications are temporarily unavailable.</p>
        )}

        {selectedSessionId && (
          <div className="selected-booking panel">
            <div>
              <span className="eyebrow">YOUR SELECTED SPACE</span>
              <strong>
                {chosenSession ? (
                  <SessionTime startsAt={chosenSession.startsAt} />
                ) : (
                  "Loading selected Space…"
                )}
              </strong>
              <span>{chosenSession?.title}</span>
              {chosenSession && !selectionValid && (
                <span role="alert">
                  This slot is no longer available. Choose another Saturday.
                </span>
              )}
            </div>
            <Link className="text-link" href="/book">
              Change date
            </Link>
          </div>
        )}
        <form
          className="panel public-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const form = e.currentTarget;
            setBusy(true);
            try {
              const p = applicationSchema.parse({
                ...fields,
                speakers: speakers === "Other" ? other : Number(speakers),
                privacyConsent: privacy,
                promotionalConsent: promo,
                hiring,
              });
              if (!selectionValid)
                throw new Error(
                  "Choose an available Saturday from the booking calendar.",
                );
              const result = await api("apply", {
                ...p,
                ...(selectedSessionId ? { sessionId: selectedSessionId } : {}),
              });
              sessionStorage.setItem("fl-confirmation-token", result.token);
              router.push("/confirmation#token=" + result.token);
            } catch (e) {
              const result = formError(e, "Could not submit application");
              setError(result.message);
              const field =
                result.field && form.elements.namedItem(result.field);
              if (field instanceof HTMLElement) field.focus();
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-section-title">
            <span>01</span>
            <h2>You & your company</h2>
          </div>
          <div className="record-form">
            <label>
              Founder name
              <input
                name="founderName"
                value={fields.founderName}
                onChange={(e) => change("founderName", e.target.value)}
                required
                maxLength={200}
                autoComplete="name"
              />
            </label>
            <label>
              Company / project name
              <input
                name="companyName"
                value={fields.companyName}
                onChange={(e) => change("companyName", e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label>
              X username
              <input
                name="xHandle"
                value={fields.xHandle}
                onChange={(e) => change("xHandle", e.target.value)}
                required
                placeholder="@yourhandle"
                maxLength={50}
              />
            </label>
            <label>
              Company website or public project link
              <input
                type="url"
                name="website"
                value={fields.website}
                onChange={(e) => change("website", e.target.value)}
                required
                placeholder="https://"
                maxLength={2000}
              />
            </label>
            <label>
              Country
              <input
                list="application-countries"
                name="country"
                value={fields.country}
                onChange={(e) => change("country", e.target.value)}
                required
                autoComplete="country-name"
              />
              <datalist id="application-countries">
                {countries.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </label>
            <label>
              Team size
              <select
                name="teamSize"
                value={fields.teamSize}
                onChange={(e) => change("teamSize", e.target.value)}
              >
                {TEAM_SIZES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Speakers representing your project
              <select
                value={speakers}
                onChange={(e) => setSpeakers(e.target.value)}
              >
                {["1", "2", "3", "Other"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {speakers === "Other" && (
              <label>
                Number of speakers
                <input
                  type="number"
                  min={4}
                  max={10}
                  value={other}
                  onChange={(e) => setOther(Number(e.target.value))}
                  required
                />
              </label>
            )}
          </div>
          <div className="form-section-title">
            <span>02</span>
            <h2>What you’re building</h2>
          </div>
          <div className="record-form">
            <label className="span-2">
              Short product description
              <textarea
                required
                maxLength={5000}
                rows={3}
                name="description"
                value={fields.description}
                onChange={(e) => change("description", e.target.value)}
                placeholder="What does it do, and who is it for?"
              />
            </label>
            <label>
              Product stage
              <select
                name="stage"
                value={fields.stage}
                onChange={(e) => change("stage", e.target.value)}
              >
                {stages.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Primary sector
              <select
                name="sector"
                value={fields.sector}
                onChange={(e) => change("sector", e.target.value)}
              >
                {sectors.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Main business focus
              <input
                required
                maxLength={5000}
                name="focus"
                value={fields.focus}
                onChange={(e) => change("focus", e.target.value)}
                placeholder="The main problem or market you are focused on"
              />
            </label>
          </div>
          <button
            type="button"
            className="optional-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "−" : "+"} Add optional details
          </button>
          {expanded && (
            <div className="record-form">
              {[
                ["founderRole", "Your role"],
                ["contact", "Telegram or email contact"],
                ["teamCountries", "Other team countries · comma separated"],
                ["ecosystem", "Blockchain ecosystem"],
                ["seeking", "Skills or partnerships being sought"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    maxLength={200}
                    value={fields[key]}
                    onChange={(e) => change(key, e.target.value)}
                  />
                </label>
              ))}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={hiring}
                  onChange={(e) => setHiring(e.target.checked)}
                />{" "}
                We are actively hiring
              </label>
              <label className="span-2">
                Additional comments
                <textarea
                  name="comments"
                  value={fields.comments}
                  onChange={(e) => change("comments", e.target.value)}
                  maxLength={5000}
                />
              </label>
            </div>
          )}
          <label className="honeypot" aria-hidden="true">
            Leave empty
            <input
              tabIndex={-1}
              name="websiteTrap"
              value={fields.websiteTrap}
              onChange={(e) => change("websiteTrap", e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="privacy-notice">
            <h3>Your information, handled carefully.</h3>
            <p>
              We use your application to review participation, coordinate
              sessions and maintain founder records. Contact details and
              internal notes are private. Public research or promotional use
              needs a separate approval and consent. You may request corrections
              or withdrawal through the programme host.{" "}
              <Link href="/terms">Privacy & programme terms</Link>.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={privacy}
                onChange={(e) => setPrivacy(e.target.checked)}
                required
              />{" "}
              I agree to the privacy notice and programme terms.
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={promo}
                onChange={(e) => setPromo(e.target.checked)}
              />{" "}
              Optional: I consent to promotional use of my submitted founder and
              project information.
            </label>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !selectionValid || !configured}
            className="button primary full-width"
          >
            {busy ? "Submitting…" : "Submit founder application"}
            <ArrowRight size={17} />
          </button>
          <small>
            Submitting an application does not guarantee a speaking slot or
            award.
          </small>
        </form>
      </main>
      <PublicFooter />
    </div>
  );
}
