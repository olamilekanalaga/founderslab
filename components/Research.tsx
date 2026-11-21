"use client";
import ResearchBrowser from "./ResearchBrowser";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, BookOpen, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "./WorkspaceContext";
import { Modal, Status, Evidence, Empty, SectionHeading } from "./ui";
import { RESEARCH_SECTIONS, CONFIDENCE, VERIFICATION } from "@/lib/catalog";
import { niceDate } from "@/lib/selectors";
import type { Resource } from "./RecordEditor";
import type { DataState } from "@/lib/types";
type RecordRow = DataState["research"][number];
export default function Research({
  edit,
}: {
  edit: (resource: Resource, record?: Record<string, unknown>) => void;
}) {
  const { state: s, viewer, path } = useWorkspace(),
    params = useSearchParams();
  const [founder, setFounder] = useState(params.get("founder") || ""),
    [status, setStatus] = useState(""),
    [mode, setMode] = useState("workspace"),
    [record, setRecord] = useState<RecordRow | null | undefined>(undefined);
  const filtered = s.research.filter(
    (r) =>
      (!founder || r.founderId === founder) && (!status || r.status === status),
  );
  const can = viewer.permissions.includes("research.write");
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Founder research</h1>
        </div>
        <div className="heading-actions">
          {can && (
            <>
              <button className="button" onClick={() => edit("need")}>
                Add business need
              </button>
              <button
                className="button primary"
                onClick={() => setRecord(null)}
              >
                <Plus size={16} /> Add research
              </button>
            </>
          )}
        </div>
      </div>
      <div className="filter-bar">
        <label>
          Founder
          <select value={founder} onChange={(e) => setFounder(e.target.value)}>
            <option value="">All founders</option>
            {s.founders.map((f) => (
              <option value={f.id} key={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Research status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option>Draft</option>
            <option>Complete</option>
          </select>
        </label>
        <span className="muted">
          {filtered.length} research records · {s.needs.length} documented needs
        </span>
      </div>
      <div className="directory-view-bar">
        <span>{filtered.length} interviews</span>
        <div className="segmented">
          <button
            aria-pressed={mode === "workspace"}
            onClick={() => setMode("workspace")}
          >
            Workspace
          </button>
          <button
            aria-pressed={mode === "table"}
            onClick={() => setMode("table")}
          >
            Table
          </button>
          <button
            aria-pressed={mode === "needs"}
            onClick={() => setMode("needs")}
          >
            Business needs
          </button>
        </div>
      </div>
      {mode === "workspace" ? (
        <ResearchBrowser records={filtered} onEdit={setRecord} />
      ) : mode === "table" ? (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Founder / company</th>
                  <th>Space</th>
                  <th>Researcher / date</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>
                        {s.founders.find((f) => f.id === r.founderId)?.name}
                      </b>
                      <small>
                        {s.companies.find((c) => c.id === r.companyId)?.name}
                      </small>
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        href={path("spaces", r.sessionId)}
                      >
                        {s.sessions.find((v) => v.id === r.sessionId)?.title}
                      </Link>
                    </td>
                    <td>
                      <b>{r.researcher}</b>
                      <small>{niceDate(r.recordedAt)}</small>
                    </td>
                    <td>
                      {r.confidence}
                      <small>{r.visibility}</small>
                    </td>
                    <td>
                      <Status value={r.status} />
                    </td>
                    <td>
                      <button className="button" onClick={() => setRecord(r)}>
                        {can ? "Open / edit" : "Read notes"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <Empty>
                No research records match. Approve a session participant before
                adding an appearance record.
              </Empty>
            )}
          </div>
        </section>
      ) : null}
      <section className="panel" hidden={mode !== "needs"}>
        <SectionHeading
          title="Business needs & explicit signals"
          detail="Needs preserve the evidence they came from. Hiring is never inferred from team size."
        />
        <div className="needs-grid">
          {s.needs
            .filter(
              (n) =>
                !founder ||
                s.memberships.some(
                  (m) => m.founderId === founder && m.companyId === n.companyId,
                ),
            )
            .map((n) => (
              <article className="need-card" key={n.id}>
                <div className="row-between">
                  <span className="tag">{n.kind}</span>
                  {can && (
                    <button
                      className="icon-button"
                      aria-label={`Edit need ${n.id}`}
                      onClick={() =>
                        edit("need", n as unknown as Record<string, unknown>)
                      }
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                <h3>{s.companies.find((c) => c.id === n.companyId)?.name}</h3>
                <p>{n.description}</p>
                <small>{n.evidence}</small>
                <div className="inline">
                  <Status value={n.verification} />
                  <span className="muted">{n.confidence} confidence</span>
                </div>
              </article>
            ))}
        </div>
      </section>
      {record !== undefined && (
        <ResearchEditor record={record} close={() => setRecord(undefined)} />
      )}
    </>
  );
}
function ResearchEditor({
  record,
  close,
}: {
  record: RecordRow | null;
  close: () => void;
}) {
  const { state: s, viewer, commit, busy } = useWorkspace(),
    can = viewer.permissions.includes("research.write");
  const choices = s.participants.filter((p) => p.attendance !== "Cancelled");
  const initial =
    choices.find(
      (p) =>
        p.founderId === record?.founderId &&
        p.companyId === record?.companyId &&
        p.sessionId === record?.sessionId,
    ) || choices[0];
  const [participantId, setParticipant] = useState(initial?.id || ""),
    [evidence, setEvidence] = useState(record?.evidence || ""),
    [confidence, setConfidence] = useState(record?.confidence || "Medium"),
    [verification, setVerification] = useState(
      record?.verification || "Self-reported",
    ),
    [visibility, setVisibility] = useState(record?.visibility || "Private"),
    [status, setStatus] = useState(record?.status || "Draft"),
    [recordedAt, setDate] = useState(
      (record?.recordedAt || new Date().toISOString()).slice(0, 16),
    );
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      RESEARCH_SECTIONS.map((section) => [
        section,
        s.answers.find(
          (a) => a.researchId === record?.id && a.section === section,
        )?.response || "",
      ]),
    ),
  );
  const [classes, setClasses] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      RESEARCH_SECTIONS.map((section) => [
        section,
        s.answers.find(
          (a) => a.researchId === record?.id && a.section === section,
        )?.classification || "",
      ]),
    ),
  );
  const [error, setError] = useState("");
  return (
    <Modal
      title={
        record ? "Founder interview record" : "Document a founder appearance"
      }
      close={close}
      wide
    >
      <form
        className="stack-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const p = choices.find((p) => p.id === participantId);
          if (!p)
            return setError("Choose an approved session appearance first.");
          const ok = await commit({
            type: "research.save",
            payload: {
              id: record?.id,
              founderId: p.founderId,
              companyId: p.companyId,
              sessionId: p.sessionId,
              recordedAt: new Date(recordedAt + ":00Z").toISOString(),
              evidence,
              confidence,
              verification,
              visibility,
              status,
              answers,
              classifications: classes,
            },
          });
          if (ok) close();
          else
            setError(
              "Record not saved. Check the notification and required sections.",
            );
        }}
      >
        <label>
          Founder · company · session
          <select
            disabled={!can || Boolean(record)}
            required
            value={participantId}
            onChange={(e) => setParticipant(e.target.value)}
          >
            <option value="">Select an approved appearance</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {s.founders.find((f) => f.id === p.founderId)?.name} ·{" "}
                {s.companies.find((c) => c.id === p.companyId)?.name} ·{" "}
                {s.sessions.find((v) => v.id === p.sessionId)?.title}
              </option>
            ))}
          </select>
        </label>
        <div className="two-grid">
          <label>
            Recorded at · UTC
            <input
              disabled={!can}
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            Research status
            <select
              disabled={!can}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option>Draft</option>
              <option>Complete</option>
            </select>
          </label>
        </div>
        <p className="form-note">
          Researcher: {record?.researcher || viewer.name}. Use written notes or
          paste an excerpt. Keep observations separate from verified facts.
        </p>
        {RESEARCH_SECTIONS.map((section, i) => (
          <details
            className="research-section"
            key={section}
            open={i === 0 || undefined}
          >
            <summary>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {section}
              <BookOpen size={15} />
            </summary>
            <label>
              Notes · {section}
              <textarea
                aria-label={`Notes · ${section}`}
                disabled={!can}
                maxLength={5000}
                rows={4}
                value={answers[section]}
                onChange={(e) =>
                  setAnswers((v) => ({ ...v, [section]: e.target.value }))
                }
              />
            </label>
            <label>
              Classification · {section}
              <select
                disabled={!can}
                value={classes[section]}
                onChange={(e) =>
                  setClasses((v) => ({ ...v, [section]: e.target.value }))
                }
              >
                <option value="">Not classified</option>
                {s.labels
                  .filter(
                    (l) =>
                      l.active &&
                      [
                        "Business needs",
                        "Customer segment",
                        "Economic function",
                        "Product stage",
                        "Business model",
                      ].includes(l.group),
                  )
                  .map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.group}: {l.name}
                    </option>
                  ))}
              </select>
            </label>
          </details>
        ))}
        <label>
          Evidence source
          <textarea
            disabled={!can}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            required
            minLength={10}
          />
        </label>
        <div className="two-grid">
          <label>
            Confidence
            <select
              disabled={!can}
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
            >
              {CONFIDENCE.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Verification
            <select
              disabled={!can}
              value={verification}
              onChange={(e) => setVerification(e.target.value)}
            >
              {VERIFICATION.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Visibility
            <select
              disabled={!can}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option>Private</option>
              {viewer.permissions.includes("team.manage") && (
                <option>Public</option>
              )}
            </select>
          </label>
        </div>
        {!can && record && (
          <Evidence
            source={record.evidence}
            confidence={record.confidence}
            verification={record.verification}
          />
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {can && (
          <div className="form-actions">
            <button className="button" type="button" onClick={close}>
              Cancel
            </button>
            <button disabled={busy} className="button primary" type="submit">
              Save research <ArrowUpRight size={15} />
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
