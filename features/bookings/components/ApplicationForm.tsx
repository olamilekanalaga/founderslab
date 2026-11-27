"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mic } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";

import { publicSlotOpen, type PublicSession } from "@/lib/dates/booking";
import { COUNTRIES, SECTORS, TEAM_SIZES } from "@/lib/catalog";
import { publicApplicationSchema as applicationSchema } from "@/lib/validation/application";

import PublicFooter from "@/components/layout/PublicFooter";
import { api } from "@/features/bookings/lib/public-api";
import { FounderContact } from "@/features/bookings/components/FounderContact";
export function ApplicationForm({
  configured,
  referral,
}: {
  configured: boolean;
  referral: { handle: string | null; locked: boolean; valid: boolean };
}) {
  const params = useSearchParams(),
    router = useRouter();
  const selectedSessionId = params.get("session") || "";
  const [availableSessions, setAvailableSessions] = useState<PublicSession[]>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [speakers, setSpeakers] = useState(""),
    [other, setOther] = useState("4");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<Record<string, string>>({
    founderName: "",
    companyName: "",
    xHandle: "",
    projectXHandle: "",
    website: "",
    country: "",
    description: "",
    teamSize: "",
    sector: "",
    focus: "",
    founderRole: "Founder",
    contact: "",
    ecosystem: "",
    comments: "",
    websiteTrap: "",
  });
  const [privacy, setPrivacy] = useState(false),
    [promo, setPromo] = useState(false),
    [hiring, setHiring] = useState("");
  const [catalog, setCatalog] = useState({
    countries: COUNTRIES,
    sectors: SECTORS,
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
  const chosenSession = availableSessions?.find(
    (s) => s.id === selectedSessionId,
  );
  const selectionValid =
    !selectedSessionId ||
    Boolean(
      chosenSession &&
      publicSlotOpen(chosenSession, chosenSession.availableSeats),
    );
  const countries = catalog.countries,
    sectors = catalog.sectors;
  const change = (key: string, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));
  const fieldAttributes = (name: string) => ({
    "aria-invalid": fieldErrors[name] ? true : undefined,
    "aria-describedby": fieldErrors[name]
      ? `application-${name}-error`
      : undefined,
  });
  const fieldMessage = (name: string) =>
    fieldErrors[name] && (
      <small
        className="application-field-error"
        id={`application-${name}-error`}
        aria-hidden="true"
      >
        {fieldErrors[name]}
      </small>
    );
  const errorCount = Object.keys(fieldErrors).length;
  return (
    <div className="public-app">
      <PublicHeader />
      <main
        className="public-form-page founder-application-page"
        id="main-content"
      >
        <section
          className="panel founder-application-card"
          aria-labelledby="founder-application-title"
        >
          <header className="founder-application-heading">
            <span className="founder-application-mark">
              <Mic size={23} aria-hidden="true" />
            </span>
            <h1 id="founder-application-title">Founder application</h1>
            <p>For founders with live Web3 products.</p>
          </header>
          {!configured && (
            <p role="alert">Applications are temporarily unavailable.</p>
          )}

          {!selectionValid &&
            (error || availableSessions ? (
              <>
                <p className="error" role="alert">
                  {error || "That Sunday is no longer available."}
                </p>
                <Link className="fl-inline-action" href="/#choose-a-sunday">
                  Return to booking calendar
                </Link>
              </>
            ) : (
              <p role="status">Checking availability…</p>
            ))}
          <form
            hidden={!selectionValid}
            className="public-form"
            noValidate
            onChange={(event) => {
              const name = event.target.getAttribute("name");
              if (!name) return;
              if (
                fieldErrors[name] ||
                (name === "speakers" && fieldErrors.otherSpeakers)
              )
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next[name];
                  if (name === "speakers") delete next.otherSpeakers;
                  return next;
                });
            }}
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || !selectionValid || !configured) return;
              setError("");
              const form = event.currentTarget;
              // Read current inputs, including values supplied by browser autofill.
              const answers = Object.fromEntries(new FormData(form));
              const controls = Array.from(
                form.querySelectorAll<
                  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                >("input[name], select[name], textarea[name]"),
              );
              const issues: Record<string, string> = {};
              for (const control of controls) {
                const { name, validity } = control;
                if (name === "otherSpeakers" && !validity.valid)
                  issues[name] = "Enter a whole number from 4 to 10.";
                else if (validity.valueMissing)
                  issues[name] =
                    control instanceof HTMLSelectElement
                      ? "Select an option."
                      : name === "privacyConsent"
                        ? "Accept the privacy notice and programme terms."
                        : name === "comments"
                          ? "Enter a comment or type None."
                          : "Fill in this field.";
              }
              const parsed = applicationSchema.safeParse({
                ...answers,
                speakers:
                  answers.speakers === "Other"
                    ? answers.otherSpeakers
                    : answers.speakers,
                privacyConsent: answers.privacyConsent === "on",
                promotionalConsent: answers.promotionalConsent === "on",
                hiring: answers.hiring === "yes",
              });
              if (!parsed.success)
                for (const issue of parsed.error.issues) {
                  const name =
                    issue.path[0] === "speakers" && answers.speakers === "Other"
                      ? "otherSpeakers"
                      : String(issue.path[0] ?? "");
                  if (name === "websiteTrap" || !name)
                    setError(
                      "Could not submit the application. Please try again.",
                    );
                  else
                    issues[name] ??=
                      name === "contact"
                        ? "Enter a valid email address or leave this blank."
                        : issue.message;
                }
              setFieldErrors(issues);
              const firstInvalid = controls.find(
                (control) => issues[control.name],
              );
              if (firstInvalid) {
                requestAnimationFrame(() => firstInvalid.focus());
                return;
              }
              if (!parsed.success) return;
              setBusy(true);
              try {
                const result = await api("apply", {
                  ...parsed.data,
                  ...(selectedSessionId
                    ? { sessionId: selectedSessionId }
                    : {}),
                });
                router.push("/confirmation#token=" + result.token);
              } catch (e) {
                setError(
                  e instanceof Error && e.message
                    ? e.message
                    : "Could not submit the application. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-section-title">
              <h2>About you</h2>
            </div>
            <div className="record-form">
              <label>
                Founder name
                <input
                  name="founderName"
                  {...fieldAttributes("founderName")}
                  value={fields.founderName}
                  onChange={(e) => change("founderName", e.target.value)}
                  required
                  maxLength={200}
                  autoComplete="name"
                />
                {fieldMessage("founderName")}
              </label>
              <label>
                Your role
                <input
                  name="founderRole"
                  {...fieldAttributes("founderRole")}
                  required
                  maxLength={200}
                  value={fields.founderRole}
                  onChange={(e) => change("founderRole", e.target.value)}
                />
                {fieldMessage("founderRole")}
              </label>
              <label className="span-2">
                Your personal X username
                <input
                  name="xHandle"
                  {...fieldAttributes("xHandle")}
                  value={fields.xHandle}
                  onChange={(e) => change("xHandle", e.target.value)}
                  required
                  placeholder="@yourhandle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  maxLength={50}
                />
                {fieldMessage("xHandle")}
              </label>
              {referral.valid && (
                <label className="span-2">
                  BD referrer’s X username
                  <input
                    value={referral.handle || "Registered BD partner"}
                    readOnly
                  />
                </label>
              )}
              {referral.locked && !referral.valid && (
                <p className="muted span-2">
                  This referral link is unavailable. You can still apply.
                </p>
              )}
              <label className="span-2">
                Contact email (optional)
                <input
                  name="contact"
                  {...fieldAttributes("contact")}
                  type="email"
                  placeholder="Optional"
                  autoComplete="email"
                  maxLength={200}
                  value={fields.contact}
                  onChange={(e) => change("contact", e.target.value)}
                />
                {fieldMessage("contact")}
              </label>
            </div>
            <div className="form-section-title">
              <h2>About your project</h2>
            </div>
            <div className="record-form">
              <label className="span-2">
                Company / project name
                <input
                  name="companyName"
                  {...fieldAttributes("companyName")}
                  value={fields.companyName}
                  onChange={(e) => change("companyName", e.target.value)}
                  required
                  maxLength={200}
                />
                {fieldMessage("companyName")}
              </label>
              <label className="span-2">
                Official project X username
                <input
                  name="projectXHandle"
                  {...fieldAttributes("projectXHandle")}
                  required
                  value={fields.projectXHandle}
                  onChange={(e) => change("projectXHandle", e.target.value)}
                  placeholder="@yourproject"
                  maxLength={50}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                {fieldMessage("projectXHandle")}
              </label>
              <label className="span-2">
                Company website or public project link
                <input
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  name="website"
                  {...fieldAttributes("website")}
                  value={fields.website}
                  onChange={(e) => change("website", e.target.value)}
                  required
                  placeholder="example.com"
                  maxLength={2000}
                />
                {fieldMessage("website")}
              </label>
              <label>
                Country
                <input
                  list="application-countries"
                  name="country"
                  {...fieldAttributes("country")}
                  value={fields.country}
                  onChange={(e) => change("country", e.target.value)}
                  required
                  placeholder="United Kingdom"
                  autoComplete="country-name"
                />
                <datalist id="application-countries">
                  {countries.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </datalist>
                {fieldMessage("country")}
              </label>
              <label>
                Team size
                <select
                  name="teamSize"
                  {...fieldAttributes("teamSize")}
                  required
                  value={fields.teamSize}
                  onChange={(e) => change("teamSize", e.target.value)}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  {TEAM_SIZES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                {fieldMessage("teamSize")}
              </label>
              <label className="span-2">
                Speakers representing your project
                <select
                  name="speakers"
                  {...fieldAttributes("speakers")}
                  required
                  value={speakers}
                  onChange={(e) => setSpeakers(e.target.value)}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  {["1", "2", "3", "Other"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                {fieldMessage("speakers")}
              </label>
              {speakers === "Other" && (
                <label className="span-2">
                  Number of speakers
                  <input
                    name="otherSpeakers"
                    {...fieldAttributes("otherSpeakers")}
                    type="number"
                    min={4}
                    max={10}
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    required
                  />
                  {fieldMessage("otherSpeakers")}
                </label>
              )}

              <label className="span-2">
                Short product description
                <textarea
                  required
                  maxLength={5000}
                  rows={3}
                  name="description"
                  {...fieldAttributes("description")}
                  value={fields.description}
                  onChange={(e) => change("description", e.target.value)}
                  placeholder="What does it do, and who is it for?"
                />
                {fieldMessage("description")}
              </label>
              <label className="span-2">
                Primary sector
                <select
                  name="sector"
                  {...fieldAttributes("sector")}
                  required
                  value={fields.sector}
                  onChange={(e) => change("sector", e.target.value)}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  {sectors.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                {fieldMessage("sector")}
              </label>
              <label className="span-2">
                Main business focus
                <input
                  required
                  maxLength={5000}
                  name="focus"
                  {...fieldAttributes("focus")}
                  value={fields.focus}
                  onChange={(e) => change("focus", e.target.value)}
                  placeholder="The main problem or market you are focused on"
                />
                {fieldMessage("focus")}
              </label>
              <label className="span-2">
                Chain
                <input
                  name="ecosystem"
                  {...fieldAttributes("ecosystem")}
                  required
                  placeholder="e.g. Solana, Ethereum, Base"
                  maxLength={200}
                  value={fields.ecosystem}
                  onChange={(e) => change("ecosystem", e.target.value)}
                />
                <small>Separate multiple chains with commas.</small>
                {fieldMessage("ecosystem")}
              </label>
              <label className="span-2">
                Are you actively hiring?
                <select
                  name="hiring"
                  {...fieldAttributes("hiring")}
                  required
                  value={hiring}
                  onChange={(e) => setHiring(e.target.value)}
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {fieldMessage("hiring")}
              </label>
              <label className="span-2">
                Additional comments
                <textarea
                  name="comments"
                  {...fieldAttributes("comments")}
                  required
                  placeholder="Enter None if no additional comments"
                  value={fields.comments}
                  onChange={(e) => change("comments", e.target.value)}
                  maxLength={5000}
                />
                {fieldMessage("comments")}
              </label>
            </div>
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
                needs a separate approval and consent. You may request
                corrections or withdrawal through the programme host.{" "}
                <Link href="/terms">Privacy & programme terms</Link>.
              </p>
              <label className="check-label">
                <input
                  name="privacyConsent"
                  {...fieldAttributes("privacyConsent")}
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                  required
                />{" "}
                I agree to the privacy notice and programme terms.
              </label>
              {fieldMessage("privacyConsent")}
              <label className="check-label">
                <input
                  name="promotionalConsent"
                  type="checkbox"
                  checked={promo}
                  onChange={(e) => setPromo(e.target.checked)}
                />{" "}
                Optional: I consent to promotional use of my submitted founder
                and project information.
              </label>
            </div>
            {errorCount > 0 && (
              <p className="error" role="alert">
                {errorCount === 1
                  ? "Check the highlighted field before submitting."
                  : `Check the ${errorCount} highlighted fields before submitting.`}
              </p>
            )}
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
            </button>
            <small>
              Submitting an application does not guarantee a speaking slot.
            </small>
          </form>
        </section>
        <FounderContact />
      </main>
      <PublicFooter />
    </div>
  );
}
