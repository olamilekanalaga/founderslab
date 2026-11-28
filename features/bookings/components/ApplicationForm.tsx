"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mic } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";

import {
  isSunday,
  publicSlotOpen,
  type PublicSession,
} from "@/lib/dates/booking";
import { COUNTRIES, SECTORS, TEAM_SIZES } from "@/lib/catalog";
import { founderRegistrationSchema as applicationSchema } from "@/lib/validation/application";
import {
  publicSpaceAcknowledgement,
  spaceDiscussionOptions,
  spaceInvitation,
} from "@/lib/space-registration";
import SessionTime from "@/components/shared/SessionTime";
import RegistrationIntro from "./RegistrationIntro";

import PublicFooter from "@/components/layout/PublicFooter";
import { api } from "@/features/bookings/lib/public-api";
import { prepareProjectLogo } from "@/features/bookings/lib/project-logo";
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
  const requestedSessionId = params.get("session") || "";
  const [step, setStep] = useState<"intro" | "sunday" | "form">("intro");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [availabilityError, setAvailabilityError] = useState(false);
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
    founderRole: "Founder",
    contact: "",
    ecosystem: "",
    websiteTrap: "",
  });
  const logoInput = useRef<HTMLInputElement>(null);
  const logoSelection = useRef(0);
  const [logo, setLogo] = useState("");
  const [logoError, setLogoError] = useState("");
  const [preparingLogo, setPreparingLogo] = useState(false);
  async function changeLogo(file?: File) {
    const selection = ++logoSelection.current;
    setFieldErrors((current) => {
      if (!current.projectLogo) return current;
      const next = { ...current };
      delete next.projectLogo;
      return next;
    });
    setLogo("");
    setLogoError("");
    setPreparingLogo(Boolean(file));
    if (!file) return;
    try {
      const prepared = await prepareProjectLogo(file);
      if (selection === logoSelection.current) setLogo(prepared);
    } catch (error) {
      if (selection === logoSelection.current)
        setLogoError(
          error instanceof Error && error.name === "Error"
            ? error.message
            : "Could not open that image.",
        );
    } finally {
      if (selection === logoSelection.current) setPreparingLogo(false);
    }
  }
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
    if (step === "sunday")
      void api("sessions")
        .then((r) => setAvailableSessions(r.sessions))
        .catch(() => setAvailabilityError(true));
  }, [step]);
  const nextSession = availableSessions?.find(isSunday);
  const openSession =
    nextSession && publicSlotOpen(nextSession, nextSession.availableSeats)
      ? nextSession
      : null;
  const selectionValid = Boolean(
    selectedSessionId && openSession?.id === selectedSessionId,
  );
  function goTo(next: typeof step) {
    setStep(next);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.getElementById("founder-application-title")?.focus();
    });
  }
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
            <h1 id="founder-application-title" tabIndex={-1}>
              {step === "intro"
                ? spaceInvitation
                : step === "sunday"
                  ? "Choose a Sunday"
                  : "Founder application"}
            </h1>
            {step === "form" && openSession && (
              <p>
                <SessionTime startsAt={openSession.startsAt} />
              </p>
            )}
          </header>
          {!configured && (
            <p role="alert">Applications are temporarily unavailable.</p>
          )}

          {step === "intro" && (
            <RegistrationIntro onContinue={() => goTo("sunday")} />
          )}
          {step === "sunday" && (
            <div className="registration-intro">
              {requestedSessionId &&
                availableSessions &&
                openSession?.id !== requestedSessionId && (
                  <p role="status">That Sunday is no longer available.</p>
                )}
              {availabilityError ? (
                <p role="alert">
                  Could not load Sundays. Please check the booking calendar.
                </p>
              ) : !availableSessions ? (
                <p role="status">Checking availability…</p>
              ) : openSession ? (
                <div className="registration-slot">
                  <strong>
                    <SessionTime startsAt={openSession.startsAt} />
                  </strong>
                  <button
                    type="button"
                    className="button primary"
                    disabled={!configured}
                    onClick={() => {
                      setSelectedSessionId(openSession.id);
                      goTo("form");
                    }}
                  >
                    Continue with this Sunday
                  </button>
                </div>
              ) : (
                <p>No Sunday is open for bookings right now.</p>
              )}
              <Link className="fl-inline-action" href="/#choose-a-sunday">
                Return to booking calendar
              </Link>
            </div>
          )}
          <form
            hidden={step !== "form"}
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
              if (busy || preparingLogo || !selectionValid || !configured)
                return;
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
              if (logoError) issues.projectLogo = logoError;
              for (const control of controls) {
                const { name, validity } = control;
                if (name === "otherSpeakers" && !validity.valid)
                  issues[name] = "Enter a whole number from 4 to 10.";
                else if (
                  validity.valueMissing &&
                  name !== "discussionPreference" &&
                  name !== "publicSpaceConsent"
                )
                  issues[name] =
                    control instanceof HTMLSelectElement
                      ? "Select an option."
                      : name === "privacyConsent"
                        ? "Accept the privacy notice and programme terms."
                        : "Fill in this field.";
              }
              const parsed = applicationSchema.safeParse({
                ...answers,
                projectLogo: logo || undefined,
                speakers:
                  answers.speakers === "Other"
                    ? answers.otherSpeakers
                    : answers.speakers,
                privacyConsent: answers.privacyConsent === "on",
                promotionalConsent: answers.promotionalConsent === "on",
                hiring: answers.hiring === "yes",
                publicSpaceConsent: answers.publicSpaceConsent === "on",
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
                  sessionId: selectedSessionId,
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
              <label className="span-2">
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
                X handle
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
              <label>
                Role
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
                Email (optional)
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
                Company name
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
              <label>
                X handle
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
              <label>
                Website
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
                    Select
                  </option>
                  {TEAM_SIZES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                {fieldMessage("teamSize")}
              </label>
              <label>
                Speakers
                <select
                  name="speakers"
                  {...fieldAttributes("speakers")}
                  required
                  value={speakers}
                  onChange={(e) => setSpeakers(e.target.value)}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {["1", "2", "3", "Other"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                {fieldMessage("speakers")}
              </label>
              <label>
                Sector
                <select
                  name="sector"
                  {...fieldAttributes("sector")}
                  required
                  value={fields.sector}
                  onChange={(e) => change("sector", e.target.value)}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {sectors.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                {fieldMessage("sector")}
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
                What are you building?
                <textarea
                  required
                  maxLength={5000}
                  rows={3}
                  name="description"
                  {...fieldAttributes("description")}
                  value={fields.description}
                  onChange={(e) => change("description", e.target.value)}
                  placeholder="Tell us briefly what your product does and who it helps."
                />
                {fieldMessage("description")}
              </label>
              <label>
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
              <label>
                Hiring?
                <select
                  name="hiring"
                  {...fieldAttributes("hiring")}
                  required
                  value={hiring}
                  onChange={(e) => setHiring(e.target.value)}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {fieldMessage("hiring")}
              </label>
              <div className="span-2 application-logo">
                <label>
                  Company logo (optional)
                  <input
                    ref={logoInput}
                    name="projectLogo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-invalid={Boolean(logoError || fieldErrors.projectLogo)}
                    aria-describedby={
                      logoError
                        ? "company-logo-help company-logo-error"
                        : fieldErrors.projectLogo
                          ? "company-logo-help application-projectLogo-error"
                          : "company-logo-help"
                    }
                    onChange={(event) =>
                      void changeLogo(event.currentTarget.files?.[0])
                    }
                  />
                </label>
                <small id="company-logo-help">
                  JPG, PNG or WebP. Up to 8 MB.
                </small>
                {preparingLogo && <p role="status">Preparing logo…</p>}
                {logoError ? (
                  <p
                    id="company-logo-error"
                    className="application-field-error"
                    role="alert"
                  >
                    {logoError}
                  </p>
                ) : (
                  fieldMessage("projectLogo")
                )}
                {(logo || logoError || preparingLogo) && (
                  <div className="application-logo-preview">
                    {logo && (
                      <Image
                        src={logo}
                        alt="Company logo preview"
                        unoptimized
                        width={48}
                        height={48}
                      />
                    )}
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        if (logoInput.current) logoInput.current.value = "";
                        void changeLogo();
                      }}
                    >
                      Remove logo
                    </button>
                  </div>
                )}
              </div>
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
              <h3>Before you join</h3>
              <p>
                We use your registration to prepare for the Space. Share only
                what you’re comfortable discussing live. Keep sensitive details
                out of this form.{" "}
                <Link href="/terms">Privacy & programme terms</Link>.
              </p>
              <fieldset className="space-discussion-options">
                <legend>What are you comfortable discussing live?</legend>
                {spaceDiscussionOptions.map(({ value, label }) => (
                  <label className="check-label" key={value}>
                    <input
                      type="radio"
                      name="discussionPreference"
                      value={value}
                      required
                      {...fieldAttributes("discussionPreference")}
                    />{" "}
                    {label}
                  </label>
                ))}
                {fieldMessage("discussionPreference")}
              </fieldset>
              <label className="check-label">
                <input
                  name="publicSpaceConsent"
                  type="checkbox"
                  required
                  {...fieldAttributes("publicSpaceConsent")}
                />{" "}
                {publicSpaceAcknowledgement}
              </label>
              {fieldMessage("publicSpaceConsent")}
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
                Optional: I consent to promotional use of the founder and
                project information I approve for public use.
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
              disabled={busy || preparingLogo || !selectionValid || !configured}
              className="button primary full-width"
            >
              {busy ? "Submitting…" : "Request booking"}
            </button>
            <small>
              We’ll confirm receipt immediately. A place is confirmed after the
              team approves your booking.
            </small>
          </form>
        </section>
        <FounderContact />
      </main>
      <PublicFooter />
    </div>
  );
}
