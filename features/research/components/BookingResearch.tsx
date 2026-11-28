"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, FlaskConical } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { ExternalLink, Status } from "@/components/ui";
import {
  discoveryQuestions,
  researchNoteLabels,
  researchStatuses,
  type BusinessDiscovery,
  type ResearchNotes,
} from "@/lib/business-research";
import SessionTime from "@/components/shared/SessionTime";
import { spaceDiscussionLabel } from "@/lib/space-registration";
import SpaceFollowUp from "@/features/consultations/components/SpaceFollowUp";

type QueueItem = {
  id: string;
  founderName: string;
  companyName: string;
  booking: { status: string; session: { startsAt: string } } | null;
  submittedAt: string | null;
  status: string;
};
type ResearchWorkspace = QueueItem & {
  description: string;
  website: string;
  xHandle: string;
  projectXHandle: string | null;
  discussionPreference: string | null;
  discovery: BusinessDiscovery | null;
  notes: ResearchNotes;
  revision: number;
};

async function researchRequest<T>(
  id?: string,
  payload?: Record<string, unknown>,
  csrf?: string,
): Promise<T> {
  const response = await fetch(
    "/api/booking-research" +
      (id ? "?application=" + encodeURIComponent(id) : ""),
    payload
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf || "",
          },
          body: JSON.stringify(payload),
        }
      : { cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not open research.");
  return data;
}

export default function BookingResearch({ id }: { id?: string }) {
  const { viewer, path } = useWorkspace();
  const canEdit = viewer.permissions.includes("research.write");
  const [queue, setQueue] = useState<(QueueItem & { challenge: string })[]>();
  const [workspace, setWorkspace] = useState<ResearchWorkspace>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (id) {
          const result = await researchRequest<ResearchWorkspace>(id);
          if (mounted) {
            setWorkspace(result);
            setStatus(result.status);
          }
        } else {
          const rows =
            await researchRequest<(QueueItem & { challenge: string })[]>();
          if (mounted) setQueue(rows);
        }
      } catch (error) {
        if (mounted)
          setError(
            error instanceof Error ? error.message : "Could not open research.",
          );
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  async function write<Result>(
    payload: Record<string, unknown>,
    success: (result: Result) => void,
  ) {
    if (busy || !id) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      success(
        await researchRequest<Result>(
          undefined,
          { ...payload, applicationId: id },
          viewer.csrf,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save research.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!id)
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>Research</h1>
            <p>
              Review submitted business information, prepare for the Space and record follow-up.
            </p>
          </div>
        </div>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : !queue ? (
          <p role="status">Loading research…</p>
        ) : !queue.length ? (
          <p>No founders in the research queue yet.</p>
        ) : (
          <div className="research-queue">
            {queue.map((item) => (
              <Link
                key={item.id}
                className="panel padded research-queue-row"
                href={path("research", item.id)}
              >
                <span>
                  <strong>{item.companyName}</strong>
                  <small>{item.founderName}</small>
                </span>
                <span className="research-challenge">
                  {item.challenge || "Founder profile only"}
                </span>
                <Status value={item.status} />
                <ChevronRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </>
    );

  if (!workspace)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Loading research workspace…"}
      </p>
    );
  const discovery = workspace.discovery;
  return (
    <div className="booking-research">
      <Link className="back-link" href={path("research")}>
        <ArrowLeft size={16} aria-hidden="true" /> Research queue
      </Link>
      <div className="page-heading">
        <div>
          <h1>{workspace.companyName}</h1>
          <p>{workspace.founderName}</p>
        </div>
        <Status value={workspace.status} />
      </div>
      <section className="panel padded">
        <h2>Submitted business information</h2>
        {workspace.booking && (
          <p>
            <SessionTime startsAt={workspace.booking.session.startsAt} /> ·
            Booking {workspace.booking.status.toLowerCase()}
          </p>
        )}
        <div className="inline">
          <ExternalLink href={workspace.website}>Website</ExternalLink>
          {workspace.projectXHandle && (
            <ExternalLink href={`https://x.com/${workspace.projectXHandle}`}>
              Project X
            </ExternalLink>
          )}
          <ExternalLink href={`https://x.com/${workspace.xHandle}`}>
            Founder X
          </ExternalLink>
        </div>
        <dl className="research-answers">
          {workspace.discussionPreference && (
            <div>
              <dt>Previously recorded discussion preference</dt>
              <dd>{spaceDiscussionLabel(workspace.discussionPreference)}</dd>
            </div>
          )}
          <div>
            <dt>What are they building?</dt>
            <dd>
              {discovery?.businessDescription ||
                workspace.description ||
                "No description added."}
            </dd>
          </div>
          {discovery && (
            <>
              {Object.entries(discoveryQuestions).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{discovery[key as keyof typeof discoveryQuestions]}</dd>
                </div>
              ))}
              <div>
                <dt>Areas to investigate</dt>
                <dd>{discovery.areas.join(", ")}</dd>
              </div>
              <div>
                <dt>Consent</dt>
                <dd>
                  The founder shared these answers for confidential review.
                  Confirm separately before discussing them live.
                </dd>
              </div>
            </>
          )}
        </dl>
      </section>
      <section className="panel padded">
        <h2>
          <FlaskConical size={17} aria-hidden="true" /> Private research
        </h2>
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const notes = Object.fromEntries(
              Object.keys(researchNoteLabels).map((key) => [
                key,
                String(form.get(key) || ""),
              ]),
            );
            void write<{ status: string; revision: number }>(
              { action: "save", status, notes, revision: workspace.revision },
              (result) => {
                setWorkspace({ ...workspace, notes, ...result });
                setNotice("Research saved.");
              },
            );
          }}
        >
          <label>
            Research status
            <select
              value={status}
              disabled={!canEdit}
              onChange={(event) => setStatus(event.target.value)}
            >
              {researchStatuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {Object.entries(researchNoteLabels).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                name={key}
                rows={3}
                maxLength={8_000}
                readOnly={!canEdit}
                defaultValue={workspace.notes[key as keyof ResearchNotes] || ""}
              />
            </label>
          ))}
          {canEdit && (
            <button type="submit" className="button primary" disabled={busy}>
              Save research
            </button>
          )}
        </form>
      </section>
      {viewer.permissions.includes("commercial.read") && <SpaceFollowUp applicationId={id} />}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice === "Research saved." && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
    </div>
  );
}
