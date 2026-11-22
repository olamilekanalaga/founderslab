"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Mic2,
  Lightbulb,
  CheckCircle2,
  BookOpen,
  Award,
} from "lucide-react";
import PublicHeader from "./PublicHeader";
import SessionTime from "./SessionTime";
import PublicBookingCalendar from "./PublicBookingCalendar";
import { publicSlotOpen, type PublicSession } from "@/lib/booking";
import {
  COUNTRIES,
  SECTORS,
  STAGES,
  TEAM_SIZES,
  defaultSettings,
} from "@/lib/catalog";
import { formError } from "@/lib/form-errors";
import { applicationSchema } from "@/lib/validation";
import { Status } from "./ui";
async function api(path: string, payload?: unknown) {
  const r = await fetch(
    "/api/public/" + path,
    payload
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      : { cache: "no-store" },
  );
  const v = await r.json();
  if (!r.ok) throw new Error(v.error);
  return v;
}
const subscribeBrowser = (fn: () => void) => {
  window.addEventListener("hashchange", fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener("hashchange", fn);
    window.removeEventListener("storage", fn);
  };
};
const noopSubscribe = () => () => {};
export function Landing() {
  const [sessions, setSessions] = useState<PublicSession[]>([]),
    [highlights, setHighlights] = useState<{ company: string; text: string }[]>(
      [],
    );
  useEffect(() => {
    void api("sessions")
      .then((r) => setSessions(r.sessions))
      .catch(() => {});
    void api("programme")
      .then((r) => {
        setHighlights(r.highlights);
      })
      .catch(() => {});
  }, []);
  return (
    <div className="public-app">
      <PublicHeader />
      <main id="main-content">
        <section className="landing-hero">
          <div className="eyebrow">
            <span /> A ROOM FOR BUILDERS. A LAB FOR IDEAS.
          </div>
          <h1>
            Behind every product,
            <br />
            there’s a founder
            <br />
            <em>worth understanding.</em>
          </h1>
          <p>
            Founders Lab brings Web3 founders into thoughtful conversations—and
            turns what we learn into useful research, connections and
            opportunities.
          </p>
          <div className="heading-actions">
            <Link className="button primary" href="/book">
              Choose your Saturday <ArrowRight size={16} />
            </Link>
            <Link className="button" href="/apply">
              Apply as a founder <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="host-line">
            <span className="host-avatar">OC</span>
            <span>
              Hosted by <b>⭕️La_Crrypt💰₿</b>
              <small>
                Starting with Nigeria and Africa. Open to founders worldwide.
              </small>
            </span>
          </div>
        </section>
        <section className="landing-feature-panel">
          <div>
            <Mic2 size={27} />
            <h2>Real conversations</h2>
            <p>
              Weekly X Spaces with up to five founder projects. Tell us what
              you’re building, for whom, and what comes next.
            </p>
          </div>
          <div>
            <BookOpen size={27} />
            <h2>Structured learning</h2>
            <p>
              We document products, markets and founder needs. Private research
              stays private unless publication is separately approved.
            </p>
          </div>
          <div>
            <Lightbulb size={27} />
            <h2>Useful connections</h2>
            <p>
              Discover complementary products, integration possibilities and
              business needs—without treating every peer as a competitor.
            </p>
          </div>
        </section>
        <section className="public-section">
          <div className="page-heading">
            <div>
              <div className="eyebrow">HOW TO TAKE PART</div>
              <h2>A conversation, not another pitch competition.</h2>
            </div>
          </div>
          <div className="participation-steps">
            {[
              [
                "01",
                "Tell us about your product",
                "A short application. No account required.",
              ],
              [
                "02",
                "Request a founder Space",
                "Choose a weekly session. Slots need programme approval.",
              ],
              [
                "03",
                "Share, learn and follow up",
                "Join the conversation and help us understand your next challenge.",
              ],
            ].map(([n, title, text]) => (
              <div key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="public-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE NEXT CONVERSATIONS</div>
              <h2>Upcoming founder Spaces</h2>
            </div>
            <Link className="text-link" href="/book">
              Request a slot <ArrowRight size={15} />
            </Link>
          </div>
          <div className="public-session-grid">
            {sessions.slice(0, 3).map((s) => (
              <article className="panel session-card" key={s.id}>
                <CalendarDays size={23} />
                <h3>{s.title}</h3>
                <p>
                  <SessionTime startsAt={s.startsAt} />
                </p>
                <small>
                  {s.availableSeats} / {s.capacity} project seats available ·{" "}
                  {s.host}
                </small>
                <Link className="text-link" href="/book">
                  Request booking <ArrowUpRight size={14} />
                </Link>
              </article>
            ))}
          </div>
          {!sessions.length && (
            <p className="public-empty">
              The next sessions will be published here. You can apply now or
              check back for the next programme dates.
            </p>
          )}
        </section>
        <section className="landing-award">
          <span className="award-icon">
            <Award size={35} />
          </span>
          <div>
            <div className="eyebrow">THE MONTHLY FOUNDER PROGRAMME</div>
            <h2>
              20 founders. Shared learning.
              <br />
              One human-reviewed 1 SOL award.
            </h2>
            <p>
              Each monthly campaign has published eligibility rules and
              selection criteria. The award is not an investment, endorsement or
              guarantee of participation.
            </p>
            <Link className="text-link" href="/terms">
              Read programme and award terms <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
        {highlights.length > 0 && (
          <section className="public-section">
            <h2>Approved research highlights</h2>
            {highlights.map((h) => (
              <article className="panel padded" key={h.company}>
                <h3>{h.company}</h3>
                <p>{h.text}</p>
              </article>
            ))}
          </section>
        )}
        <section className="public-callout">
          <h2>Building something useful in Web3?</h2>
          <p>We’d like to understand it.</p>
          <Link className="button primary" href="/apply">
            Apply to participate <ArrowRight size={16} />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <span>
        Founders Lab <small>with ⭕️La_Crrypt💰₿</small>
      </span>
      <div>
        <Link href="/terms">Privacy & programme terms</Link>
        <Link href="/signin">Admin sign in</Link>
      </div>
    </footer>
  );
}
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
export function Terms() {
  const [terms, setTerms] = useState(defaultSettings.terms);
  useEffect(() => {
    void api("programme")
      .then((r) => setTerms(r.settings.terms))
      .catch(() => {});
  }, []);
  return (
    <div className="public-app">
      <PublicHeader />
      <main className="public-form-page prose" id="main-content">
        <div className="eyebrow">PROGRAMME TERMS & PRIVACY</div>
        <h1>Clear expectations. Informed participation.</h1>
        <h2>Founder participation & the monthly award</h2>
        <p>{terms}</p>
        <h2>Privacy and research</h2>
        <p>
          Applications are used to review participation, arrange sessions and
          support private founder research. Confidential contact information,
          research notes and commercial opportunities are accessible only to
          authorised team members. We do not publish your application
          automatically. Promotional consent is separate and optional;
          publication of research also requires administrator approval.
        </p>
        <h2>Recording links</h2>
        <p>
          Sessions may link to publicly hosted X Spaces recordings. The
          programme stores links, not audio uploads. Participants should
          understand the host platform’s recording practices before attending.
        </p>
        <h2>Corrections, withdrawal & retention</h2>
        <p>
          Contact ⭕️La_Crrypt💰₿ through the programme’s published X identity to
          request a correction or withdraw from future promotional use. The
          administrator reviews retained information against the programme
          retention policy. Existing public recordings may remain subject to the
          recording host’s own policies. Access tokens and invitation links are
          private and should not be shared publicly.
        </p>
        <h2>Research limitations</h2>
        <p>
          Programme participants form a convenience sample, not a representative
          census of Web3 founders. Self-reported information, missing answers
          and unverified opportunity hypotheses must be identified as such.
        </p>
        <Link className="button primary" href="/apply">
          Apply with informed consent <ArrowRight size={16} />
        </Link>
      </main>
      <PublicFooter />
    </div>
  );
}
