"use client";
import { useState } from "react";
import { Search, Check, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "./WorkspaceContext";
import { Avatar, Empty } from "./ui";
import type { CompanyRow } from "@/lib/types";
export default function Classification() {
  const { state: s } = useWorkspace();
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(s.companies[0]?.id || "");
  const companies = s.companies.filter((c) =>
    `${c.name} ${c.sector}`.toLowerCase().includes(query.toLowerCase()),
  );
  const company = s.companies.find((c) => c.id === selected);
  return (
    <>
      <div className="page-heading">
        <h1>Classification</h1>
        <span className="small-tag">
          <SlidersHorizontal size={13} />
          Multi-label intelligence
        </span>
      </div>
      <div className="classification-workspace">
        <aside className="panel company-picker">
          <label className="search-input">
            <Search size={15} />
            <input
              aria-label="Search classification companies"
              placeholder="Find a company…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {companies.map((c, i) => (
            <button
              key={c.id}
              aria-pressed={selected === c.id}
              onClick={() => setSelected(c.id)}
            >
              <Avatar name={c.name} index={i} />
              <span>
                <b>{c.name}</b>
                <small>{c.sector}</small>
              </span>
            </button>
          ))}
          {!companies.length && <Empty>No companies found.</Empty>}
        </aside>
        {company ? (
          <CompanyClassification key={company.id} company={company} />
        ) : (
          <Empty>Select a company to classify.</Empty>
        )}
      </div>
    </>
  );
}
const groups = [
  "Sector",
  "Product stage",
  "Economic function",
  "Customer segment",
  "Business model",
  "Geographic market",
  "Blockchain ecosystem",
  "Business needs",
];
const fieldMap: Record<string, keyof CompanyRow> = {
  "Economic function": "economicFunctions",
  "Customer segment": "customers",
  "Business model": "businessModels",
  "Blockchain ecosystem": "ecosystems",
};
function CompanyClassification({ company: c }: { company: CompanyRow }) {
  const { state: s, viewer, commit, busy, path } = useWorkspace();
  const [selected, setSelected] = useState(
    () =>
      new Set([
        ...s.companyLabels
          .filter((l) => l.companyId === c.id)
          .map((l) => l.labelId),
        ...s.labels
          .filter((l) =>
            l.group === "Sector"
              ? l.name === c.sector
              : l.group === "Product stage"
                ? l.name === c.stage
                : fieldMap[l.group] && Array.isArray(c[fieldMap[l.group]])
                  ? (c[fieldMap[l.group]] as string[]).includes(l.name)
                  : false,
          )
          .map((l) => l.id),
      ]),
  );
  const [saved, setSaved] = useState(false);
  const can = viewer.permissions.includes("directory.write");
  function toggle(id: string, group: string) {
    setSaved(false);
    setSelected((previous) => {
      const next = new Set(previous);
      if (group === "Sector" || group === "Product stage") {
        s.labels
          .filter((l) => l.group === group)
          .forEach((l) => next.delete(l.id));
        next.add(id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function save() {
    const labels = s.labels.filter((l) => selected.has(l.id));
    const data: Record<string, unknown> = {
      ...c,
      founderIds: s.memberships
        .filter((m) => m.companyId === c.id)
        .map((m) => m.founderId),
      labelIds: [...selected],
      sector: labels.find((l) => l.group === "Sector")?.name || c.sector,
      stage: labels.find((l) => l.group === "Product stage")?.name || c.stage,
    };
    for (const [group, field] of Object.entries(fieldMap)) {
      const available = s.labels.filter((l) => l.group === group);
      if (available.length)
        data[field] = [
          ...(c[field] as string[]).filter(
            (value) => !available.some((l) => l.name === value),
          ),
          ...labels.filter((l) => l.group === group).map((l) => l.name),
        ];
    }
    if (await commit({ type: "company.save", payload: data })) setSaved(true);
  }
  return (
    <div className="classification-detail">
      <section className="panel company-summary">
        <Avatar name={c.name} />
        <h2>{c.name}</h2>
        <p>{c.description}</p>
        <dl className="facts">
          <div>
            <dt>Stage</dt>
            <dd>{c.stage}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{c.country}</dd>
          </div>
          <div>
            <dt>Team</dt>
            <dd>{c.teamSize}</dd>
          </div>
        </dl>
        <Link className="text-link" href={path("companies", c.id)}>
          Company profile
          <ArrowUpRight size={14} />
        </Link>
      </section>
      <section className="panel classification-labels">
        <div className="section-heading">
          <div>
            <h2>Labels</h2>
            <p>Independent dimensions</p>
          </div>
          <button
            disabled={!can || busy}
            className="button primary"
            onClick={() => void save()}
          >
            <Check size={15} />
            {saved ? "Saved" : "Save labels"}
          </button>
        </div>
        {groups.map((group) => (
          <div className="classification-group" key={group}>
            <h3>{group}</h3>
            <div>
              {s.labels
                .filter(
                  (l) => l.group === group && (l.active || selected.has(l.id)),
                )
                .map((l) => (
                  <button
                    key={l.id}
                    disabled={!can}
                    aria-pressed={selected.has(l.id)}
                    onClick={() => toggle(l.id, group)}
                  >
                    {l.name}
                    {selected.has(l.id) && <Check size={11} />}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
