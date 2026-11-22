"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, ArrowUpRight, LayoutGrid, List, X } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Avatar, Status, Empty } from "@/components/ui";
import type { Resource } from "@/components/shared/RecordEditor";
import FounderProfile from "@/features/founders/components/FounderProfile";
import CompanyProfile from "@/features/companies/components/CompanyProfile";
type Editor = (resource: Resource, record?: Record<string, unknown>) => void;
export default function Directory({
  kind,
  id,
  edit,
}: {
  kind: "founders" | "companies";
  id?: string;
  edit: Editor;
}) {
  const { state: s, path, viewer } = useWorkspace(),
    params = useSearchParams(),
    router = useRouter();
  const incoming = params.get("q") || "";
  const [searchState, setSearch] = useState({
    source: incoming,
    value: incoming,
  });
  if (searchState.source !== incoming)
    setSearch({ source: incoming, value: incoming });
  const query = searchState.source === incoming ? searchState.value : incoming;
  const country = params.get("country") || "",
    sector = params.get("sector") || "",
    stage = params.get("stage") || "",
    view = params.get("view") || "cards";
  const page = Math.max(0, Number(params.get("page")) || 0);
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.set("q", query);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!next.get("q")) next.delete("q");
    router.replace(`${path(kind)}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  }
  if (id)
    return kind === "founders" ? (
      <FounderProfile id={id} edit={edit} />
    ) : (
      <CompanyProfile id={id} edit={edit} />
    );
  const companies = s.companies.filter(
    (c) => (!sector || c.sector === sector) && (!stage || c.stage === stage),
  );
  const founders = s.founders.filter(
    (f) =>
      (!country || f.country === country) &&
      `${f.name} ${f.xHandle} ${s.memberships
        .filter((m) => m.founderId === f.id)
        .map((m) => s.companies.find((c) => c.id === m.companyId)?.name)
        .join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      ((!sector && !stage) ||
        s.memberships.some(
          (m) =>
            m.founderId === f.id && companies.some((c) => c.id === m.companyId),
        )),
  );
  const visibleCompanies = companies.filter(
    (c) =>
      (!country || c.country === country) &&
      `${c.name} ${c.xHandle || ""} ${c.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const count = kind === "founders" ? founders.length : visibleCompanies.length;
  const currentPage = Math.min(
    searchState.value !== searchState.source ? 0 : page,
    Math.max(0, Math.ceil(count / 12) - 1),
  );
  const shownFounders = founders.slice(currentPage * 12, currentPage * 12 + 12),
    shownCompanies = visibleCompanies.slice(
      currentPage * 12,
      currentPage * 12 + 12,
    );
  const options = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean))).sort();
  const filtered = Boolean(query || country || sector || stage);
  const add = () => edit(kind === "founders" ? "founder" : "company");
  const empty = (
    <Empty
      title={filtered ? "No matching records" : `Your ${kind} start here`}
      action={
        filtered ? (
          <button
            className="button"
            onClick={() => {
              setSearch({ source: "", value: "" });
              router.replace(path(kind));
            }}
          >
            Clear filters
          </button>
        ) : viewer.permissions.includes("directory.write") ? (
          <button className="button" onClick={add}>
            <Plus size={16} />
            Add {kind === "founders" ? "founder" : "company"}
          </button>
        ) : undefined
      }
    >
      {filtered
        ? "Try a different name, country, sector or product stage."
        : "Approved applications create linked founder and company records. Add existing programme contacts here."}
    </Empty>
  );
  const pagination = count > 0 && (
    <div className="directory-pagination">
      <span>
        {currentPage * 12 + 1}–{Math.min((currentPage + 1) * 12, count)} of{" "}
        {count} {kind}
      </span>
      <div>
        <button
          className="button"
          disabled={currentPage === 0}
          onClick={() => update({ page: String(currentPage - 1) })}
        >
          Previous
        </button>
        <button
          className="button"
          disabled={(currentPage + 1) * 12 >= count}
          onClick={() => update({ page: String(currentPage + 1) })}
        >
          Next
        </button>
      </div>
    </div>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Programme directory</span>
          <h1>
            {kind === "founders" ? "Founder directory" : "Company directory"}
          </h1>
          <p>
            {kind === "founders"
              ? "The people behind your programme. Find a founder, explore their projects and keep their details up to date."
              : "The projects in your programme. Explore what they build, who leads them and where they operate."}
          </p>
        </div>
        {viewer.permissions.includes("directory.write") && (
          <button className="button primary" onClick={add}>
            <Plus size={17} />
            Add {kind === "founders" ? "founder" : "company"}
          </button>
        )}
      </div>
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: query, page: "" });
        }}
      >
        <label className="search-input">
          <Search size={18} />
          <input
            aria-label={`Search ${kind}`}
            placeholder={`Search ${kind}${kind === "founders" ? " or X handles" : " or products"}…`}
            value={query}
            onChange={(e) =>
              setSearch({ source: incoming, value: e.target.value })
            }
            onBlur={() => {
              if (query !== incoming) update({ q: query, page: "" });
            }}
          />
        </label>
        <select
          aria-label="Filter country"
          value={country}
          onChange={(e) => update({ country: e.target.value, page: "" })}
        >
          <option value="">All countries</option>
          {options(
            (kind === "founders" ? s.founders : s.companies).map(
              (v) => v.country,
            ),
          ).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Filter sector"
          value={sector}
          onChange={(e) => update({ sector: e.target.value, page: "" })}
        >
          <option value="">All sectors</option>
          {options(s.companies.map((c) => c.sector)).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Filter stage"
          value={stage}
          onChange={(e) => update({ stage: e.target.value, page: "" })}
        >
          <option value="">All stages</option>
          {options(s.companies.map((c) => c.stage)).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        {filtered && (
          <button
            className="icon-button"
            type="button"
            aria-label="Clear directory filters"
            onClick={() => {
              setSearch({ source: "", value: "" });
              router.replace(path(kind));
            }}
          >
            <X size={17} />
          </button>
        )}
      </form>
      <div className="directory-view-bar">
        <span>
          {count} {kind}
          {filtered ? " match your filters" : " in your programme"}
        </span>
        <div className="segmented">
          <button
            aria-pressed={view !== "table"}
            onClick={() => update({ view: "cards" })}
          >
            <LayoutGrid size={16} />
            Cards
          </button>
          <button
            aria-pressed={view === "table"}
            onClick={() => update({ view: "table" })}
          >
            <List size={16} />
            Table
          </button>
        </div>
      </div>
      {!count ? (
        <section className="panel">{empty}</section>
      ) : view !== "table" ? (
        <div className="founder-card-grid">
          {kind === "founders"
            ? shownFounders.map((f, i) => {
                const co = s.memberships
                  .filter((m) => m.founderId === f.id)
                  .map((m) => s.companies.find((c) => c.id === m.companyId))
                  .filter((c) => !!c);
                return (
                  <article className="founder-tile" key={f.id}>
                    <div className="row-between">
                      <Avatar name={f.name} index={i} />
                      <Link
                        className="icon-button"
                        href={path("founders", f.id)}
                        aria-label={`Open ${f.name}`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </div>
                    <Link
                      className="founder-tile-name"
                      href={path("founders", f.id)}
                    >
                      {f.name}
                    </Link>
                    <span className="founder-tile-company">
                      {co.map((c) => c.name).join(" · ") || f.role}
                    </span>
                    <span className="founder-tile-handle">@{f.xHandle}</span>
                    <p className="founder-short-description">
                      {co[0]?.description || "No product description recorded."}
                    </p>
                    <div className="founder-tile-footer">
                      <span>{f.country}</span>
                      <span>{co[0]?.sector || "Unclassified"}</span>
                    </div>
                  </article>
                );
              })
            : shownCompanies.map((c, i) => (
                <article className="founder-tile" key={c.id}>
                  <div className="row-between">
                    <Avatar name={c.name} index={i} />
                    <Link
                      className="icon-button"
                      href={path("companies", c.id)}
                      aria-label={`Open ${c.name}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </div>
                  <Link
                    className="founder-tile-name"
                    href={path("companies", c.id)}
                  >
                    {c.name}
                  </Link>
                  <span className="founder-tile-company">
                    {c.sector} · {c.stage}
                  </span>
                  <p className="founder-short-description">{c.description}</p>
                  <div className="founder-tile-footer">
                    <span>{c.country}</span>
                    <span>{c.teamSize} people</span>
                  </div>
                </article>
              ))}
          {pagination}
        </div>
      ) : (
        <>
          <section className="panel">
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label={`${kind} directory table`}
            >
              <table>
                <thead>
                  <tr>
                    <th>{kind === "founders" ? "Founder" : "Company"}</th>
                    <th>{kind === "founders" ? "Company" : "Founders"}</th>
                    <th>Country</th>
                    <th>Sector</th>
                    <th>{kind === "founders" ? "Description" : "Stage"}</th>
                    <th>
                      <span className="sr-only">Open record</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {kind === "founders"
                    ? shownFounders.map((f, i) => {
                        const co = s.memberships
                          .filter((m) => m.founderId === f.id)
                          .map((m) =>
                            s.companies.find((c) => c.id === m.companyId),
                          )
                          .filter((c) => !!c);
                        return (
                          <tr key={f.id}>
                            <td>
                              <Link
                                className="table-person"
                                href={path(kind, f.id)}
                              >
                                <Avatar name={f.name} index={i} />
                                <span>
                                  <b>{f.name}</b>
                                  <small>@{f.xHandle}</small>
                                </span>
                              </Link>
                            </td>
                            <td>
                              {co.map((c) => c.name).join(", ") ||
                                "Not recorded"}
                            </td>
                            <td>{f.country}</td>
                            <td>{co[0]?.sector || "Unclassified"}</td>
                            <td>{co[0]?.description || "Not recorded"}</td>
                            <td>
                              <Link
                                className="icon-button"
                                href={path(kind, f.id)}
                                aria-label={`Open ${f.name}`}
                              >
                                <ArrowUpRight size={17} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    : shownCompanies.map((c, i) => (
                        <tr key={c.id}>
                          <td>
                            <Link
                              className="table-person"
                              href={path(kind, c.id)}
                            >
                              <Avatar name={c.name} index={i} />
                              <b>{c.name}</b>
                            </Link>
                          </td>
                          <td>
                            {s.memberships
                              .filter((m) => m.companyId === c.id)
                              .map(
                                (m) =>
                                  s.founders.find((f) => f.id === m.founderId)
                                    ?.name,
                              )
                              .filter(Boolean)
                              .join(", ") || "Not recorded"}
                          </td>
                          <td>{c.country}</td>
                          <td>{c.sector}</td>
                          <td>
                            <Status value={c.stage} />
                          </td>
                          <td>
                            <Link
                              className="icon-button"
                              href={path(kind, c.id)}
                              aria-label={`Open ${c.name}`}
                            >
                              <ArrowUpRight size={17} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </section>
          {pagination}
        </>
      )}
    </>
  );
}
