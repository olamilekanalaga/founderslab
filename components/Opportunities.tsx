"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Pencil,
  ArrowUpRight,
  LayoutGrid,
  List,
  CalendarDays,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { PIPELINE } from "@/lib/catalog";
import { Modal, Evidence, Status, Empty, SectionHeading } from "./ui";
import { niceDate } from "@/lib/selectors";
import type { Resource } from "./RecordEditor";
export default function Opportunities({
  edit,
}: {
  edit: (resource: Resource, record?: Record<string, unknown>) => void;
}) {
  const { state: s, viewer, path, commit, busy } = useWorkspace();
  const [mode, setMode] = useState("board"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const rows = s.opportunities.filter(
    (o) =>
      (!category || o.category === category) &&
      (!status || o.status === status) &&
      `${s.companies.find((c) => c.id === o.companyId)?.name} ${o.solution} ${o.owner}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const can = viewer.permissions.includes("commercial.write"),
    o = s.opportunities.find((o) => o.id === selected);
  const renderCard = (item: (typeof rows)[number]) => (
    <article className="opportunity-card" key={item.id}>
      <button className="opportunity-open" onClick={() => setSelected(item.id)}>
        <span className="tag">{item.category}</span>
        <h3>{s.companies.find((c) => c.id === item.companyId)?.name}</h3>
        <p>{item.solution}</p>
      </button>
      <div className="opportunity-card-meta">
        <span>{item.owner}</span>
        <span>
          <CalendarDays size={12} />
          {niceDate(item.followUpDate)}
        </span>
      </div>
      {can ? (
        <select
          disabled={busy}
          aria-label={`Opportunity status ${item.id}`}
          value={item.status}
          onChange={(e) =>
            void commit({
              type: "opportunity.save",
              payload: { ...item, status: e.target.value },
            })
          }
        >
          {PIPELINE.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      ) : (
        <Status value={item.status} />
      )}
    </article>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TURN INSIGHT INTO OPPORTUNITY</div>
          <h1>Opportunity pipeline</h1>
          <p>Private signals, careful qualification and a clear next action.</p>
        </div>
        {can && (
          <button
            className="button primary"
            onClick={() => edit("opportunity")}
          >
            <Plus size={16} /> Add opportunity
          </button>
        )}
      </div>
      <div className="filter-bar">
        <label className="search-input">
          <Search size={16} />
          <input
            aria-label="Search opportunities"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Company, solution or owner…"
          />
        </label>
        <select
          aria-label="Opportunity category filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All types</option>
          {Array.from(
            new Set([
              ...s.labels
                .filter((l) => l.group === "Opportunity type" && l.active)
                .map((l) => l.name),
              ...s.opportunities.map((o) => o.category),
            ]),
          ).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Opportunity status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All stages</option>
          {PIPELINE.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <div className="segmented">
          <button
            aria-pressed={mode === "board"}
            onClick={() => setMode("board")}
          >
            <LayoutGrid size={14} /> Board
          </button>
          <button
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            <List size={14} /> List
          </button>
        </div>
      </div>
      {mode === "board" ? (
        <div className="kanban" aria-label="Opportunity pipeline board">
          {PIPELINE.filter((p) => !status || p === status).map((stage) => (
            <section className="kanban-column" key={stage}>
              <div className="kanban-heading">
                <b>{stage}</b>
                <span>{rows.filter((o) => o.status === stage).length}</span>
              </div>
              {rows.filter((o) => o.status === stage).map(renderCard)}
              {!rows.some((o) => o.status === stage) && (
                <p className="kanban-empty">No opportunities</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <SectionHeading title={`${rows.length} opportunities`} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company / need</th>
                  <th>Type</th>
                  <th>Owner</th>
                  <th>Follow-up</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button
                        className="table-title"
                        onClick={() => setSelected(o.id)}
                      >
                        <b>
                          {s.companies.find((c) => c.id === o.companyId)?.name}
                        </b>
                        <small>
                          {s.needs.find((n) => n.id === o.needId)?.kind}
                        </small>
                      </button>
                    </td>
                    <td>{o.category}</td>
                    <td>{o.owner}</td>
                    <td>{niceDate(o.followUpDate)}</td>
                    <td>
                      <Status value={o.status} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open opportunity ${o.id}`}
                        onClick={() => setSelected(o.id)}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {!rows.length && (
        <Empty>
          No opportunities match. Add a documented need before creating a new
          opportunity.
        </Empty>
      )}
      {o && (
        <Modal
          title={
            s.companies.find((c) => c.id === o.companyId)?.name +
            " · " +
            o.category
          }
          close={() => setSelected(null)}
          wide
        >
          <div className="stack">
            <div className="row-between">
              <Status value={o.status} />
              {can && (
                <button
                  className="button"
                  onClick={() => {
                    edit(
                      "opportunity",
                      o as unknown as Record<string, unknown>,
                    );
                    setSelected(null);
                  }}
                >
                  <Pencil size={15} /> Edit opportunity
                </button>
              )}
            </div>
            <h3>Identified need</h3>
            <p>{s.needs.find((n) => n.id === o.needId)?.description}</p>
            <h3>Potential solution</h3>
            <p>{o.solution}</p>
            <div className="tags">
              {o.skills.map((v) => (
                <span className="tag" key={v}>
                  {v}
                </span>
              ))}
            </div>
            <dl className="facts">
              <div>
                <dt>Related founder</dt>
                <dd>
                  <Link
                    className="text-link"
                    href={path("founders", o.founderId)}
                  >
                    {s.founders.find((f) => f.id === o.founderId)?.name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Decision-maker</dt>
                <dd>{o.decisionMaker}</dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>{o.budget || "Unknown"}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{o.owner}</dd>
              </div>
              <div>
                <dt>Follow-up</dt>
                <dd>{niceDate(o.followUpDate)}</dd>
              </div>
            </dl>
            <h3>Next action</h3>
            <p>{o.nextAction}</p>
            {o.outcome && (
              <>
                <h3>Outcome</h3>
                <p>{o.outcome}</p>
              </>
            )}
            <Evidence
              source={o.evidence}
              verification="Opportunity hypothesis"
              confidence="Validate with decision-maker"
            />
            <h3>Activity history</h3>
            {s.activities
              .filter((a) => a.opportunityId === o.id)
              .map((a) => (
                <div className="compact-note" key={a.id}>
                  <b>{a.actor}</b>
                  <p>{a.note}</p>
                  <small>{niceDate(a.createdAt)}</small>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
