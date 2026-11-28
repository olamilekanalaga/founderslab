"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  businessDiscoverySchema,
  readDiscovery,
} from "@/lib/business-research";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import { noopSubscribe, subscribeBrowser } from "../lib/confirmation-store";
import { api } from "../lib/public-api";
import { DiscoveryFields, ResearchConsent } from "./DiscoveryFields";

export default function BusinessDiscoveryForm() {
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
  const token = new URLSearchParams(fragment.slice(1)).get("token");
  const [lookup, setLookup] = useState<{
    token: string;
    business?: { companyName: string; description: string };
    error?: string;
  }>();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api("business-discovery", { action: "open", token })
      .then((business) => {
        if (active) setLookup({ token, business });
      })
      .catch((error) => {
        if (active) setLookup({ token, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [token]);

  const business =
    token && lookup?.token === token ? lookup.business : undefined;
  const unavailable =
    mounted &&
    (!token
      ? "Open the private link sent by the Founders Lab team."
      : lookup?.token === token && lookup.error);

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
              {submitted
                ? "Business information received"
                : business
                  ? "Tell us about your business"
                  : "Private form"}
            </h1>
            {business && !submitted && <p>{business.companyName}</p>}
          </header>
          {submitted ? (
            <p role="status">
              We’ve added your answers to your existing registration. Your
              booking status stays the same.
            </p>
          ) : unavailable ? (
            <p role="alert" className="error">
              {unavailable}
            </p>
          ) : !business ? (
            <p role="status">Checking your private link…</p>
          ) : (
            <form
              className="public-form"
              noValidate
              onSubmit={async (event) => {
                event.preventDefault();
                if (!token || busy) return;
                setError("");
                const form = event.currentTarget;
                const formData = new FormData(form);
                const parsed = businessDiscoverySchema.safeParse({
                  ...readDiscovery(formData),
                  businessDescription: formData.get("businessDescription"),
                });
                if (!parsed.success) {
                  const next = Object.fromEntries(
                    parsed.error.issues.map((issue) => [
                      String(issue.path[0]),
                      issue.message,
                    ]),
                  );
                  setIssues(next);
                  const first = Array.from(
                    form.querySelectorAll<HTMLElement>("[name]"),
                  ).find((element) => next[element.getAttribute("name") || ""]);
                  requestAnimationFrame(() => first?.focus());
                  return;
                }
                setIssues({});
                setBusy(true);
                try {
                  await api("business-discovery", {
                    action: "submit",
                    token,
                    discovery: parsed.data,
                  });
                  setSubmitted(true);
                  history.replaceState(history.state, "", location.pathname);
                  window.scrollTo(0, 0);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Could not save your answers.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p className="discovery-intro">
                Share what you’d like the team to look into privately. Short
                answers are enough. Leave out confidential financial figures,
                credentials and customer data.
              </p>
              <div className="record-form">
                <label className="span-2">
                  What are you building?
                  <textarea
                    name="businessDescription"
                    rows={4}
                    maxLength={5_000}
                    required
                    defaultValue={business.description}
                    aria-invalid={Boolean(issues.businessDescription)}
                  />
                  {issues.businessDescription && (
                    <small className="application-field-error">
                      {issues.businessDescription}
                    </small>
                  )}
                </label>
              </div>
              <DiscoveryFields errors={issues} />
              <div className="privacy-notice">
                <h2>Confidential review</h2>
                <p>
                  Your answers are private to the research team. In the public,
                  recorded Space, we’ll discuss only information you approve.
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
                {busy ? "Saving…" : "Send business information"}
              </button>
            </form>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
