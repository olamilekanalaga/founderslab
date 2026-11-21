"use client";
import { useState } from "react";
import { ArrowUpRight, BookOpen, Link2 } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { Avatar, Status, Empty, ExternalLink } from "./ui";
import type { DataState } from "@/lib/types";
export default function ResearchBrowser({
  records,
  onEdit,
}: {
  records: DataState["research"];
  onEdit: (record: DataState["research"][number]) => void;
}) {
  const { state: s, viewer } = useWorkspace();
  const [selected, setSelected] = useState(records[0]?.id || ""),
    [tab, setTab] = useState("Summary");
  const record = records.find((r) => r.id === selected) || records[0];
  if (!record) return <Empty>No research records match.</Empty>;
  const company = s.companies.find((c) => c.id === record.companyId),
    founder = s.founders.find((f) => f.id === record.founderId),
    session = s.sessions.find((v) => v.id === record.sessionId),
    answers = s.answers.filter((a) => a.researchId === record.id);
  const needs = s.needs.filter((n) => n.companyId === record.companyId);
  const shown =
    tab === "Summary"
      ? answers.filter((a) =>
          [
            "Product and customer",
            "Business challenges",
            "Integration and partnership needs",
            "Next milestones",
          ].includes(a.section),
        )
      : answers;
  return (
    <div className="research-workspace">
      <aside className="panel research-roster">
        <div className="section-heading">
          <h2>Founder interviews</h2>
          <span className="small-tag">{records.length}</span>
        </div>
        {records.map((r, i) => {
          const co = s.companies.find((c) => c.id === r.companyId),
            f = s.founders.find((f) => f.id === r.founderId);
          return (
            <button
              key={r.id}
              aria-pressed={record.id === r.id}
              onClick={() => {
                setSelected(r.id);
                setTab("Summary");
              }}
            >
              <Avatar name={f?.name || "Founder"} index={i} />
              <span>
                <b>{co?.name}</b>
                <small>{f?.name}</small>
              </span>
            </button>
          );
        })}
      </aside>
      <section className="panel research-reader">
        <div className="research-reader-heading">
          <div>
            <span className="eyebrow">RESEARCH NOTES</span>
            <h2>{company?.name}</h2>
            <small>
              {founder?.name} · {record.recordedAt.slice(0, 10)}
            </small>
          </div>
          <Status value={record.status} />
        </div>
        <div className="tabs">
          {["Summary", "Notes", "Actions"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "Actions" ? (
          <div className="research-takeaways">
            <h3>Follow-up</h3>
            <p>{founder?.followUp || "No follow-up recorded."}</p>
            {needs.map((n) => (
              <article key={n.id}>
                <span className="tag">{n.kind}</span>
                <p>{n.description}</p>
                <small>{n.evidence}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="research-takeaways">
            {shown.map((a) => (
              <article key={a.id}>
                <h3>{a.section}</h3>
                <p>{a.response || "Not recorded."}</p>
                {a.classification && (
                  <span className="tag">{a.classification}</span>
                )}
              </article>
            ))}
          </div>
        )}
        <div className="research-reader-footer">
          <div className="inline">
            <span className="small-tag">
              <BookOpen size={12} />
              {record.confidence} confidence
            </span>
            {session?.recordingUrl && (
              <ExternalLink href={session.recordingUrl}>
                <Link2 size={12} />
                Recording
              </ExternalLink>
            )}
          </div>
          <button className="button primary" onClick={() => onEdit(record)}>
            {viewer.permissions.includes("research.write")
              ? "Open / edit"
              : "Read notes"}
            <ArrowUpRight size={13} />
          </button>
        </div>
      </section>
    </div>
  );
}
