"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import {
  consultationLink,
  followUpLabels,
  followUpStatuses,
  type FollowUp,
  type FollowUpField,
} from "@/lib/consultations";
import CopyConsultationLink from "./CopyConsultationLink";
import { commercialRequest } from "../commercial-api";

type FollowUpLead = {
  id: string;
  followUp: FollowUp | null;
  followUpStatus: string;
  followUpVersion: number;
  offeredAt: string | null;
};

export default function SpaceFollowUp({
  applicationId,
}: {
  applicationId: string;
}) {
  const { viewer } = useWorkspace();
  const canEdit = viewer.permissions.includes("commercial.write");
  const [lead, setLead] = useState<FollowUpLead | null>();
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void commercialRequest<{ lead: FollowUpLead | null }>(
      "?application=" + encodeURIComponent(applicationId),
    )
      .then(({ lead }) => {
        if (!active) return;
        setLead(lead);
        setMessage(lead?.followUp?.message || "");
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [applicationId]);

  async function run(
    action: object,
    onSuccess: (result: {
      id: string;
      version?: number;
      token?: string;
    }) => void,
  ) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      onSuccess(
        await commercialRequest("", {
          csrf: viewer.csrf,
          data: { ...action, applicationId },
        }),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel padded" aria-labelledby="space-follow-up">
      <h2 id="space-follow-up">After the Space</h2>
      {lead !== undefined && (
        <>
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              const followUp = Object.fromEntries(
                Object.keys(followUpLabels).map((key) => [
                  key,
                  String(values.get(key) || ""),
                ]),
              );
              const status = String(values.get("status"));
              void run(
                {
                  action: "save-follow-up",
                  followUp,
                  status,
                  version: lead?.followUpVersion ?? 0,
                },
                (result) => {
                  setLead({
                    id: result.id,
                    followUp,
                    followUpStatus: status,
                    followUpVersion: result.version!,
                    offeredAt: lead?.offeredAt ?? null,
                  });
                  setNotice("Follow-up saved.");
                },
              );
            }}
          >
            <label>
              Follow-up status
              <select
                name="status"
                defaultValue={lead?.followUpStatus ?? followUpStatuses[0]}
                disabled={!canEdit}
              >
                {followUpStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            {Object.entries(followUpLabels).map(([key, label]) => (
              <label key={key}>
                {label}
                {key === "message" ? (
                  <textarea
                    name={key}
                    rows={4}
                    placeholder="Describe what you observed, why it matters and invite the founder to talk privately."
                    maxLength={8_000}
                    readOnly={!canEdit}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                ) : (
                  <textarea
                    name={key}
                    rows={3}
                    maxLength={8_000}
                    readOnly={!canEdit}
                    defaultValue={lead?.followUp?.[key as FollowUpField] || ""}
                  />
                )}
              </label>
            ))}
            {canEdit && (
              <button className="button primary" disabled={busy}>
                Save follow-up
              </button>
            )}
          </form>
          <div className="stack-form research-discovery-link">
            {canEdit && !link && (
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => {
                  void run({ action: "issue-space-link" }, (result) => {
                    setLink(consultationLink(result.token!));
                    setLead({
                      id: result.id,
                      followUp: lead?.followUp ?? null,
                      followUpStatus: lead?.followUpStatus || "Not started",
                      followUpVersion: lead?.followUpVersion ?? 0,
                      offeredAt: new Date().toISOString(),
                    });
                  });
                }}
              >
                {lead?.offeredAt
                  ? "Replace private booking link"
                  : "Create private booking link"}
              </button>
            )}
            {canEdit && message.trim() && !link && (
              <button
                className="button"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message.trim());
                    setNotice("Follow-up copied.");
                  } catch {
                    setNotice("Select the follow-up text to copy it.");
                  }
                }}
              >
                Copy follow-up message
              </button>
            )}
            {link && (
              <CopyConsultationLink
                key={link}
                link={link}
                message={message.trim()}
              />
            )}
            {lead && (
              <Link href={`/commercial/${lead.id}`} className="text-link">
                Open commercial record
              </Link>
            )}
          </div>
        </>
      )}
      {lead === undefined && !error && <p role="status">Loading follow-up…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
    </section>
  );
}
