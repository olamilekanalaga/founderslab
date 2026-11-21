"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, List, Network, Pencil, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { Status, Empty, Evidence } from "./ui";
import type { Resource } from "./RecordEditor";
export default function MarketMap({
  edit,
}: {
  edit: (resource: Resource, record?: Record<string, unknown>) => void;
}) {
  const { state: s, viewer, path } = useWorkspace();
  const [mode, setMode] = useState("network"),
    [type, setType] = useState(""),
    [company, setCompany] = useState("");
  const rows = s.relationships.filter(
    (r) =>
      (!type || r.type === type) &&
      (!company || r.companyAId === company || r.companyBId === company),
  );
  const ids = Array.from(
    new Set(rows.flatMap((r) => [r.companyAId, r.companyBId])),
  );
  const nodes = ids.map((id, i) => ({
    id,
    name: s.companies.find((c) => c.id === id)?.name || "Company",
    x: 500 + Math.cos((2 * Math.PI * i) / Math.max(ids.length, 1)) * 340,
    y: 250 + Math.sin((2 * Math.PI * i) / Math.max(ids.length, 1)) * 190,
  }));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Market map</h1>
        </div>
        {viewer.permissions.includes("research.write") && (
          <button
            className="button primary"
            onClick={() => edit("relationship")}
          >
            <Plus size={16} /> Add relationship
          </button>
        )}
      </div>
      <div className="filter-bar">
        <select
          aria-label="Relationship type filter"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All relationship types</option>
          {Array.from(
            new Set([
              ...s.labels
                .filter((l) => l.group === "Company relationship" && l.active)
                .map((l) => l.name),
              ...s.relationships.map((r) => r.type),
            ]),
          ).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Relationship company filter"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">All companies</option>
          {s.companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="segmented">
          <button
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            <List size={15} /> List
          </button>
          <button
            aria-pressed={mode === "network"}
            onClick={() => setMode("network")}
          >
            <Network size={15} /> Network
          </button>
        </div>
      </div>
      {mode === "network" ? (
        <section className="panel network-panel">
          <div className="network-caption">
            <b>
              {nodes.length} companies · {rows.length} explicit relationships
            </b>
            <span>Click a company to inspect the context.</span>
          </div>
          <div className="network-scroll">
            <svg
              viewBox="0 0 1000 500"
              role="img"
              aria-label="Company relationship network"
            >
              <title>
                Explicit company relationships, not sector-based assumptions
              </title>
              {rows.map((r) => {
                const a = nodes.find((n) => n.id === r.companyAId)!,
                  b = nodes.find((n) => n.id === r.companyBId)!;
                return (
                  <g key={r.id}>
                    <title>
                      {a.name} → {b.name}: {r.type}. {r.verification}
                    </title>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={
                        r.type.includes("competitor") ? "#e293ab" : "#b7a2ed"
                      }
                      strokeWidth={2}
                      strokeDasharray={
                        r.verification === "Verified" ? undefined : "6 4"
                      }
                    />
                  </g>
                );
              })}
              {nodes.map((n, i) => (
                <a
                  key={n.id}
                  href={path("companies", n.id)}
                  aria-label={`Open ${n.name}`}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={25}
                    fill={i % 2 ? "#ede7ff" : "#e6e9ff"}
                    stroke="#9c83e5"
                  />
                  <text
                    x={n.x}
                    y={n.y + 5}
                    textAnchor="middle"
                    fontSize="13"
                    fill="#25342c"
                  >
                    {n.name.slice(0, 2)}
                  </text>
                  <text
                    x={n.x}
                    y={n.y + 44}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#3d453f"
                  >
                    {n.name}
                  </text>
                </a>
              ))}
            </svg>
          </div>
          <p className="workspace-footnote">
            Dashed links are hypotheses until verified. A shared sector is never
            sufficient evidence of competition.
          </p>
        </section>
      ) : (
        <div className="relationships-grid">
          {rows.map((r) => (
            <article className="panel padded" key={r.id}>
              <div className="row-between">
                <span className="tag">{r.type}</span>
                {viewer.permissions.includes("research.write") && (
                  <button
                    className="icon-button"
                    aria-label={`Edit relationship ${r.id}`}
                    onClick={() =>
                      edit(
                        "relationship",
                        r as unknown as Record<string, unknown>,
                      )
                    }
                  >
                    <Pencil size={15} />
                  </button>
                )}
              </div>
              <h2 className="relationship-title">
                <Link href={path("companies", r.companyAId)}>
                  {s.companies.find((c) => c.id === r.companyAId)?.name}
                </Link>
                <span>↔</span>
                <Link href={path("companies", r.companyBId)}>
                  {s.companies.find((c) => c.id === r.companyBId)?.name}
                </Link>
              </h2>
              <p>{r.reason}</p>
              <Status
                value={
                  r.verification === "Verified" ? "Verified" : "Hypothesis"
                }
              />
              <Evidence
                source={r.evidence}
                confidence={r.confidence}
                verification={r.verification}
              />
              <small>
                {r.researcher} · reviewed {r.reviewedAt.slice(0, 10)}
              </small>
              <Link
                className="text-link"
                href={path("companies", r.companyAId)}
              >
                Inspect company context <ArrowUpRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      )}
      {!rows.length && (
        <Empty>No explicit relationships match these filters.</Empty>
      )}
    </>
  );
}
