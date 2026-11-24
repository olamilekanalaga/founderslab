"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Users, Building2, CheckCircle2 } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Avatar, Status, ExternalLink } from "@/components/ui";
import DeleteRecordButton from "@/features/founders/components/DeleteRecordButton";
import type { DataState } from "@/lib/types";

export default function ApplicationReview({
  application: a,
  onSelect,
}: {
  application: DataState["applications"][number];
  onSelect: (id: string) => void;
}) {
  const { state, path, viewer, commit, busy } = useWorkspace();
  const can = viewer.permissions.includes("booking.write");
  const pending = state.applications
    .filter((v) => v.status === "Pending")
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
  const extra = Boolean(
    a.teamCountries.length || a.comments || a.focus || a.seeking || a.hiring,
  );
  const fact = (label: string, value: ReactNode) => (
    <tr key={label}>
      <th scope="row">{label}</th>
      <td>{value === "" || value == null ? "Not provided" : value}</td>
    </tr>
  );
  return (
    <div className="studio-review-layout">
      <aside className="studio-review-context" aria-label="Application queue">
        <div className="studio-review-context-title">
          <InboxLabel />
          <span>{pending.length} pending</span>
        </div>
        <div className="studio-review-context-list">
          {pending.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={item.id === a.id}
              onClick={() => onSelect(item.id)}
            >
              <Avatar name={item.founderName} />
              <span>
                <b>{item.companyName}</b>
                <small>{item.founderName}</small>
              </span>
            </button>
          ))}
        </div>
        {!pending.length && <p>All pending applications have been reviewed.</p>}
        <p className="studio-review-context-note">
          Application approval and project seat approval are separate steps.
        </p>
      </aside>
      <article
        className="studio-review-content"
        aria-label={`Review ${a.companyName}`}
      >
        <div className="studio-review-identity">
          <Avatar name={a.companyName} />
          <div>
            <span className="page-eyebrow">Project application</span>
            <h3>{a.companyName}</h3>
            <p>
              {a.founderName} · {a.country}
            </p>
          </div>
          <Status value={a.status} />
        </div>
        <section className="studio-review-section">
          <h4>
            <Building2 size={16} />
            The project
          </h4>
          <table className="studio-review-table" aria-label="Project answers">
            <tbody>
              {fact("Description", a.description)}
              {fact("Blockchain / chain", a.ecosystem)}
              {fact("Sector", a.sector)}
              {fact("Stage", a.stage)}
              {fact(
                "Website",
                a.website ? (
                  <ExternalLink href={a.website}>
                    Public project link
                  </ExternalLink>
                ) : null,
              )}
              {fact(
                "Project X",
                a.projectXHandle ? (
                  <ExternalLink href={`https://x.com/${a.projectXHandle}`}>
                    @{a.projectXHandle}
                  </ExternalLink>
                ) : null,
              )}
            </tbody>
          </table>
        </section>
        <section className="studio-review-section">
          <h4>
            <Users size={16} />
            Founder and contact
          </h4>
          <table
            className="studio-review-table"
            aria-label="Founder and contact answers"
          >
            <tbody>
              {fact("Founder", a.founderName)}
              {fact("Founder role", a.founderRole)}
              {fact("Country", a.country)}
              {fact("Contact", a.contact)}
              {fact(
                "Founder X",
                a.xHandle ? (
                  <ExternalLink href={`https://x.com/${a.xHandle}`}>
                    @{a.xHandle}
                  </ExternalLink>
                ) : null,
              )}
            </tbody>
          </table>
        </section>
        <details className="studio-review-extra" open={extra}>
          <summary>Team and additional information</summary>
          <table
            className="studio-review-table"
            aria-label="Team and additional answers"
          >
            <tbody>
              {fact("Team size", a.teamSize)}
              {fact("Speakers", a.speakers)}
              {fact("Team countries", a.teamCountries.join(", "))}
              {fact("Main business focus", a.focus)}
              {fact("Hiring", a.hiring ? "Yes" : "No / not supplied")}
              {fact("Seeking", a.seeking)}
              {fact("Applicant comments", a.comments)}
            </tbody>
          </table>
        </details>
        <div className="studio-review-consent">
          <table
            className="studio-review-table"
            aria-label="Consent and submission"
          >
            <tbody>
              {fact(
                "Privacy consent",
                a.privacyConsent ? "Agreed" : "Not granted",
              )}
              {fact(
                "Promotion consent",
                a.promotionalConsent ? "Granted separately" : "Not granted",
              )}
              {fact(
                "Submitted",
                new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }).format(new Date(a.createdAt)),
              )}
              {fact("Reference", a.reference)}
            </tbody>
          </table>
        </div>
        {a.status === "Approved" && (
          <div className="studio-review-approved">
            <CheckCircle2 size={19} />
            <div>
              <b>Application approved</b>
              <p>
                Founder and company records are linked. A booking still needs
                separate seat approval.
              </p>
              <div>
                {a.founderId && (
                  <Link
                    className="text-link"
                    href={path("founders", a.founderId)}
                  >
                    Founder profile
                  </Link>
                )}
                {a.companyId && (
                  <Link
                    className="text-link"
                    href={path("companies", a.companyId)}
                  >
                    Project profile
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
        {viewer.roleId !== "space-manager" && (
          <details className="studio-review-delete">
            <summary>Remove this application</summary>
            <DeleteRecordButton
              kind="application"
              id={a.id}
              name={a.founderName}
            />
          </details>
        )}
        {can && (
          <div className="studio-review-actions">
            <span>Review this application</span>
            <div>
              {["Declined", "Waitlisted", "Approved"].map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={busy || status === a.status}
                  className={`button ${status === "Approved" ? "primary" : ""}`}
                  onClick={() =>
                    void commit({
                      type: "application.review",
                      payload: { id: a.id, status },
                    })
                  }
                >
                  {status === "Approved"
                    ? "Approve application"
                    : status === "Waitlisted"
                      ? "Waitlist"
                      : "Decline"}
                </button>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
function InboxLabel() {
  return <b>Review queue</b>;
}
