"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Status } from "@/components/ui";
import {
  discoveryQuestions,
  type BusinessDiscovery,
} from "@/lib/business-research";
import {
  consultationLink,
  consultationTime,
  engagementStatuses,
  engagementTypes,
  gbp,
  pence,
  maxConsultationFeePence,
  type PipelineStage,
} from "@/lib/consultations";
import { commercialRequest } from "../commercial-api";
import CopyConsultationLink from "./CopyConsultationLink";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  _count: { appointments: number };
};
type Overview = {
  checkout: boolean;
  conversions: {
    publicParticipants: number;
    paidAfterSpace: number;
    securedAfterConsultation: number;
  };
  totals: { stage: PipelineStage; count: number }[];
  rows: {
    id: string | null;
    applicationId: string | null;
    businessName: string;
    founderName: string;
    researchStatus: string | null;
    stages: PipelineStage[];
  }[];
  settings: { feePence: number; durationMinutes: number } | null;
  slots: Slot[];
};
type Engagement = {
  id: string;
  type: string;
  problem: string;
  solution: string;
  estimatedPence: number | null;
  agreedPence: number | null;
  status: string;
  followUpOn: string | null;
  outcome: string;
};
type Appointment = {
  id: string;
  bookingStatus: string;
  paymentStatus: string;
  feePence: number;
  checkoutStartedAt: string | null;
  email: string;
  discovery: BusinessDiscovery;
  slot: { startsAt: string; endsAt: string };
};
type Detail = {
  checkout: boolean;
  lead: {
    id: string;
    founderName: string;
    businessName: string;
    applicationId: string | null;
    offeredAt: string | null;
    consultations: Appointment[];
    engagements: Engagement[];
  };
};
type Write = (
  data: object,
  message: string,
  onSuccess?: (result: { id: string; token?: string }) => void,
) => Promise<void>;

export default function CommercialPipeline({ id }: { id?: string }) {
  const { viewer } = useWorkspace();
  const canEdit = viewer.permissions.includes("commercial.write");
  const [overview, setOverview] = useState<Overview>();
  const [detail, setDetail] = useState<Detail>();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState("");
  const [view, setView] = useState<"pipeline" | "settings">("pipeline");

  useEffect(() => {
    let active = true;
    const query = id
      ? commercialRequest<Detail>("?lead=" + encodeURIComponent(id)).then(
          (data) => {
            if (active) setDetail(data);
          },
        )
      : commercialRequest<Overview>().then((data) => {
          if (active) setOverview(data);
        });
    void query.catch((error) => {
      if (active) setError(error.message);
    });
    return () => {
      active = false;
    };
  }, [id, version]);

  const write: Write = async (data, message, onSuccess) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await commercialRequest<{ id: string; token?: string }>(
        "",
        { csrf: viewer.csrf, data },
      );
      onSuccess?.(result);
      setNotice(message);
      setVersion((value) => value + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="booking-research commercial-pipeline">
      {id && (
        <Link href="/commercial" className="back-link">
          Back to commercial pipeline
        </Link>
      )}
      <div className="page-heading">
        <div>
          <h1>{detail?.lead.businessName || "Commercial pipeline"}</h1>
          <p>
            {detail?.lead.founderName ||
              "Track private consultations and commercial opportunities."}
          </p>
        </div>
        {detail?.lead.applicationId &&
          viewer.permissions.includes("research.read") && (
            <Link
              className="button"
              href={`/research/${detail.lead.applicationId}`}
            >
              Research workspace
            </Link>
          )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {id && detail ? (
        <>
          <section className="panel padded">
            <h2>Private consultation</h2>
            {canEdit && !link && (
              <button
                className="button primary"
                type="button"
                disabled={busy}
                onClick={() => {
                  void write(
                    { action: "issue-link", leadId: id },
                    "Private booking link created.",
                    (result) => setLink(consultationLink(result.token!)),
                  );
                }}
              >
                {detail.lead.offeredAt
                  ? "Replace private booking link"
                  : "Create private booking link"}
              </button>
            )}
            {link && <CopyConsultationLink key={link} link={link} />}
            {!detail.lead.consultations.length && (
              <p>No appointment booked yet.</p>
            )}
            {detail.lead.consultations.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                canEdit={canEdit}
                checkout={detail.checkout}
                busy={busy}
                write={write}
              />
            ))}
          </section>
          <section className="panel padded">
            <h2>Commercial engagements</h2>
            {detail.lead.engagements.map((engagement) => (
              <details key={engagement.id}>
                <summary>
                  {engagement.type} · {engagement.status}
                </summary>
                <EngagementForm
                  leadId={id}
                  engagement={engagement}
                  write={write}
                  readOnly={!canEdit}
                  busy={busy}
                />
              </details>
            ))}
            {canEdit &&
            detail.lead.consultations.some(
              (appointment) => appointment.bookingStatus === "Completed",
            ) ? (
              <details>
                <summary>Add an engagement</summary>
                <EngagementForm leadId={id} write={write} busy={busy} />
              </details>
            ) : (
              !detail.lead.engagements.length && (
                <p>
                  Record the completed private session to start tracking
                  engagements.
                </p>
              )
            )}
          </section>
        </>
      ) : !id && overview ? (
        <>
          <nav className="operations-tabs" aria-label="Commercial sections">
            <button
              type="button"
              aria-pressed={view === "pipeline"}
              onClick={() => setView("pipeline")}
            >
              Pipeline
            </button>
            <button
              type="button"
              aria-pressed={view === "settings"}
              onClick={() => setView("settings")}
            >
              Consultation settings
            </button>
          </nav>
          {view === "pipeline" ? (
            <>
              <section className="panel padded">
                <h2>From the Space to paid work</h2>
                <dl className="commercial-metrics">
                  <div>
                    <dt>Founders who attended</dt>
                    <dd>{overview.conversions.publicParticipants}</dd>
                  </div>
                  <div>
                    <dt>Paid after the Space</dt>
                    <dd>{overview.conversions.paidAfterSpace}</dd>
                  </div>
                  <div>
                    <dt>Secured work after consultation</dt>
                    <dd>{overview.conversions.securedAfterConsultation}</dd>
                  </div>
                </dl>
                <h2>Pipeline overview</h2>
                <dl className="commercial-metrics">
                  {overview.totals.map(({ stage, count }) => (
                    <div key={stage}>
                      <dt>{stage}</dt>
                      <dd>{count}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              {canEdit && (
                <details className="panel padded">
                  <summary>Add a business directly</summary>
                  <p>
                    Use this for a founder who hasn’t booked a public Space.
                  </p>
                  <form
                    className="stack-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const fields = new FormData(event.currentTarget);
                      const form = event.currentTarget;
                      void write(
                        {
                          action: "new-lead",
                          founderName: fields.get("founderName"),
                          businessName: fields.get("businessName"),
                        },
                        "Business added.",
                        () => form.reset(),
                      );
                    }}
                  >
                    <label>
                      Founder name
                      <input name="founderName" required maxLength={180} />
                    </label>
                    <label>
                      Business name
                      <input name="businessName" required maxLength={180} />
                    </label>
                    <button className="button primary" disabled={busy}>
                      Add business
                    </button>
                  </form>
                </details>
              )}
              <section className="panel padded">
                <h2>Businesses</h2>
                {!overview.rows.length && (
                  <p>No businesses in the pipeline yet.</p>
                )}
                <ul className="commercial-list">
                  {overview.rows.map((row) => (
                    <li key={row.applicationId || row.id}>
                      <div>
                        <strong>{row.businessName}</strong>
                        <p>
                          {row.founderName}
                          {row.researchStatus &&
                            ` · Research: ${row.researchStatus}`}
                        </p>
                      </div>
                      <div className="inline">
                        {row.stages.map((stage) => (
                          <Status key={stage} value={stage} />
                        ))}
                      </div>
                      {row.id ? (
                        <Link className="button" href={`/commercial/${row.id}`}>
                          View business
                          <span className="sr-only"> {row.businessName}</span>
                        </Link>
                      ) : (
                        row.applicationId &&
                        viewer.permissions.includes("research.read") && (
                          <Link
                            className="button"
                            href={`/research/${row.applicationId}`}
                          >
                            Open research
                            <span className="sr-only">
                              {" "}
                              for {row.businessName}
                            </span>
                          </Link>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : (
            <ConsultationSettings
              overview={overview}
              canEdit={canEdit}
              write={write}
              busy={busy}
            />
          )}
        </>
      ) : (
        !error && <p role="status">Loading commercial records…</p>
      )}
    </div>
  );
}

function ConsultationSettings({
  overview,
  canEdit,
  write,
  busy,
}: {
  overview: Overview;
  canEdit: boolean;
  write: Write;
  busy: boolean;
}) {
  return (
    <>
      <section className="panel padded">
        <h2>Fee and duration</h2>
        <p>
          {overview.checkout
            ? "Online checkout is configured."
            : "Online checkout is off. You can record an offline payment after receiving it."}
        </p>
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            void write(
              {
                action: "settings",
                settings: {
                  feePence: pence(String(values.get("fee"))),
                  durationMinutes: Number(values.get("duration")),
                },
              },
              "Consultation settings saved.",
            );
          }}
        >
          <label>
            Fee (£)
            <input
              name="fee"
              type="number"
              step="0.01"
              min="0.30"
              max={maxConsultationFeePence / 100}
              defaultValue={
                overview.settings
                  ? (overview.settings.feePence / 100).toFixed(2)
                  : ""
              }
              required
              readOnly={!canEdit}
            />
          </label>
          <label>
            Duration (minutes)
            <input
              name="duration"
              type="number"
              min="15"
              max="480"
              defaultValue={overview.settings?.durationMinutes}
              required
              readOnly={!canEdit}
            />
          </label>
          {canEdit && (
            <button className="button primary" disabled={busy}>
              Save settings
            </button>
          )}
        </form>
      </section>
      <section className="panel padded">
        <h2>Appointment availability</h2>
        {canEdit && overview.settings && (
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const startsAt = new Date(
                String(new FormData(form).get("startsAt")),
              ).toISOString();
              void write(
                { action: "add-slot", startsAt },
                "Appointment time added.",
                () => form.reset(),
              );
            }}
          >
            <label>
              Start time (your device’s time zone)
              <input name="startsAt" type="datetime-local" required />
            </label>
            <button className="button primary" disabled={busy}>
              Add appointment time
            </button>
          </form>
        )}
        <ul className="commercial-list">
          {overview.slots.map((slot) => (
            <li key={slot.id}>
              <span>{consultationTime(slot.startsAt)} · UK time</span>
              {slot._count.appointments ? (
                <Status value="Reserved or confirmed" />
              ) : (
                canEdit && (
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void write(
                        { action: "withdraw-slot", slotId: slot.id },
                        "Appointment time removed.",
                      )
                    }
                  >
                    Remove time
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
        {!overview.slots.length && <p>No future appointment times.</p>}
      </section>
    </>
  );
}

function AppointmentCard({
  appointment,
  canEdit,
  checkout,
  write,
  busy,
}: {
  appointment: Appointment;
  canEdit: boolean;
  checkout: boolean;
  write: Write;
  busy: boolean;
}) {
  const change = (status: string) =>
    void write(
      { action: "appointment", status, appointmentId: appointment.id },
      "Appointment updated.",
    );
  const discovery = appointment.discovery;
  return (
    <article className="commercial-appointment">
      <h3>{consultationTime(appointment.slot.startsAt)} · UK time</h3>
      <p>
        {gbp(appointment.feePence)} · {appointment.email}
      </p>
      <div className="inline">
        <Status value={appointment.bookingStatus} />
        <Status value={appointment.paymentStatus} />
      </div>
      <details>
        <summary>Private discovery answers</summary>
        <dl className="research-answers">
          <div>
            <dt>What are you building?</dt>
            <dd>{discovery.businessDescription}</dd>
          </div>
          {Object.entries(discoveryQuestions).map(([field, label]) => (
            <div key={field}>
              <dt>{label}</dt>
              <dd>{discovery[field as keyof typeof discoveryQuestions]}</dd>
            </div>
          ))}
          <div>
            <dt>Areas to investigate</dt>
            <dd>{discovery.areas.join(", ")}</dd>
          </div>
        </dl>
      </details>
      {canEdit && (
        <div className="inline">
          {appointment.bookingStatus === "Reserved" && (
            <>
              {!checkout && !appointment.checkoutStartedAt && (
                <button
                  className="button primary"
                  type="button"
                  disabled={busy}
                  onClick={() => change("record-payment")}
                >
                  Record payment received
                </button>
              )}
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this unpaid reservation and release the time?",
                    )
                  )
                    change("cancel");
                }}
              >
                Cancel reservation
              </button>
            </>
          )}
          {appointment.bookingStatus === "Confirmed" && (
            <button
              className="button primary"
              type="button"
              disabled={busy}
              onClick={() => change("complete")}
            >
              Mark session complete
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function EngagementForm({
  engagement,
  leadId,
  write,
  busy,
  readOnly = false,
}: {
  engagement?: Engagement;
  leadId: string;
  write: Write;
  busy: boolean;
  readOnly?: boolean;
}) {
  const amount = (value: number | null | undefined) =>
    value == null ? "" : (value / 100).toFixed(2);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const fields = Object.fromEntries(values);
    void write(
      {
        action: "engagement",
        leadId,
        engagementId: engagement?.id,
        engagement: {
          ...fields,
          estimatedPence: fields.estimatedPence
            ? pence(String(fields.estimatedPence))
            : null,
          agreedPence: fields.agreedPence
            ? pence(String(fields.agreedPence))
            : null,
          followUpOn: fields.followUpOn || null,
        },
      },
      "Engagement saved.",
      () => {
        if (!engagement) form.reset();
      },
    );
  }
  return (
    <form className="stack-form" onSubmit={save}>
      <label>
        Engagement type
        <select name="type" defaultValue={engagement?.type} disabled={readOnly}>
          {engagementTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>
        Identified problem
        <textarea
          name="problem"
          defaultValue={engagement?.problem}
          maxLength={8_000}
          required
          readOnly={readOnly}
        />
      </label>
      <label>
        Proposed solution
        <textarea
          name="solution"
          defaultValue={engagement?.solution}
          maxLength={8_000}
          readOnly={readOnly}
        />
      </label>
      <label>
        Estimated value (£)
        <input
          name="estimatedPence"
          type="number"
          min="0"
          max="10000000"
          step="0.01"
          defaultValue={amount(engagement?.estimatedPence)}
          readOnly={readOnly}
        />
      </label>
      <label>
        Agreed value (£)
        <input
          name="agreedPence"
          type="number"
          min="0"
          max="10000000"
          step="0.01"
          defaultValue={amount(engagement?.agreedPence)}
          readOnly={readOnly}
        />
      </label>
      <label>
        Proposal status
        <select
          name="status"
          defaultValue={engagement?.status}
          disabled={readOnly}
        >
          {engagementStatuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
      <label>
        Follow-up date
        <input
          name="followUpOn"
          type="date"
          defaultValue={engagement?.followUpOn?.slice(0, 10)}
          readOnly={readOnly}
        />
      </label>
      <label>
        Outcome
        <textarea
          name="outcome"
          defaultValue={engagement?.outcome}
          maxLength={8_000}
          readOnly={readOnly}
        />
      </label>
      {!readOnly && (
        <button className="button primary" disabled={busy}>
          Save engagement
        </button>
      )}
    </form>
  );
}
