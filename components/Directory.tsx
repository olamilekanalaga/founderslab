"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  ArrowUpRight,
  MapPin,
  ArrowLeft,
  Pencil,
  Building2,
  LayoutGrid,
  List,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import { Avatar, Status, Empty, SectionHeading, ExternalLink } from "./ui";
import { profileSpaceWeeks } from "@/lib/space-data";
import DeleteRecordButton from "./DeleteRecordButton";
import FounderSpaces from "./FounderSpaces";
import { niceDate } from "@/lib/selectors";
import type { Resource } from "./RecordEditor";
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
    params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || ""),
    [country, setCountry] = useState(""),
    [sector, setSector] = useState(""),
    [stage, setStage] = useState(""),
    [view, setView] = useState("cards"),
    [page, setPage] = useState(0);
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
      `${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(founders.length / 12) - 1),
  );
  const shownFounders = founders.slice(currentPage * 12, currentPage * 12 + 12);
  const count = kind === "founders" ? founders.length : visibleCompanies.length;
  const options = (values: string[]) => Array.from(new Set(values)).sort();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {kind === "founders" ? "Founder directory" : "Company directory"}
          </h1>
        </div>
        {viewer.permissions.includes("directory.write") && (
          <button
            className="button primary"
            onClick={() => edit(kind === "founders" ? "founder" : "company")}
          >
            <Plus size={16} /> Add {kind === "founders" ? "founder" : "company"}
          </button>
        )}
      </div>
      <div className="filter-bar">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label={`Search ${kind}`}
            placeholder={`Search ${kind}, ${kind === "founders" ? "X handles" : "products"}…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <select
          aria-label="Filter country"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All countries</option>
          {options(s.founders.map((f) => f.country)).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Filter sector"
          value={sector}
          onChange={(e) => {
            setSector(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All sectors</option>
          {options(s.companies.map((c) => c.sector)).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Filter stage"
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All stages</option>
          {options(s.companies.map((c) => c.stage)).map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      {kind === "founders" && (
        <div className="directory-view-bar">
          <span>{count} founders</span>
          <div className="segmented">
            <button
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
            >
              <LayoutGrid size={15} />
              Cards
            </button>
            <button
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <List size={15} />
              Table
            </button>
          </div>
        </div>
      )}
      {kind === "founders" && view === "cards" ? (
        <div className="founder-card-grid">
          {shownFounders.map((f, i) => {
            const co = s.memberships
              .filter((m) => m.founderId === f.id)
              .map((m) => s.companies.find((c) => c.id === m.companyId)!)
              .filter(Boolean);
            return (
              <article className="founder-tile" key={f.id}>
                <div className="row-between">
                  <Avatar name={f.name} index={i} />
                  <Link
                    className="icon-button"
                    href={path("founders", f.id)}
                    aria-label={`Open ${f.name}`}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
                <Link
                  href={path("founders", f.id)}
                  className="founder-tile-name"
                >
                  {f.name}
                </Link>
                <span className="founder-tile-company">
                  {co.map((c) => c.name).join(" · ") || f.role}
                </span>
                <span className="founder-tile-handle">@{f.xHandle}</span>
                <p className="founder-short-description">
                  {co[0]?.description || "No description added."}
                </p>
                <div className="founder-tile-footer">
                  <span>{f.country}</span>
                  <span>{co[0]?.sector || "Unclassified"}</span>
                </div>
              </article>
            );
          })}
          {!count && <Empty>No founders match these filters.</Empty>}
          {count > 0 && (
            <div className="directory-pagination">
              <span>
                {currentPage * 12 + 1}–{Math.min((currentPage + 1) * 12, count)}{" "}
                of {count} founders
              </span>
              <div>
                <button
                  className="button"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <button
                  className="button"
                  disabled={(currentPage + 1) * 12 >= count}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <section className="panel">
          <SectionHeading title={`${count} ${kind}`} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{kind === "founders" ? "Founder" : "Company"}</th>
                  <th>{kind === "founders" ? "Company / team" : "Founders"}</th>
                  <th>Country</th>
                  <th>Sector</th>
                  <th>{kind === "founders" ? "Description" : "Stage"}</th>
                  {kind === "companies" && (
                    <>
                      <th>Team</th>
                      <th>Description</th>
                    </>
                  )}
                  <th />
                </tr>
              </thead>
              <tbody>
                {kind === "founders"
                  ? founders.map((f, i) => {
                      const co = s.memberships
                        .filter((m) => m.founderId === f.id)
                        .map((m) =>
                          s.companies.find((c) => c.id === m.companyId)!,
                        );
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
                            <b>
                              {co.map((c) => c.name).join(", ") ||
                                "Not recorded"}
                            </b>
                            <small>{co[0]?.teamSize || "—"} people</small>
                          </td>
                          <td>{f.country}</td>
                          <td>{co[0]?.sector || "—"}</td>
                          <td>
                            {co
                              .map((c) => c.description)
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                          <td>
                            <Link
                              className="icon-button"
                              aria-label={`Open ${f.name}`}
                              href={path(kind, f.id)}
                            >
                              <ArrowUpRight size={17} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  : visibleCompanies.map((c, i) => (
                      <tr key={c.id}>
                        <td>
                          <Link
                            className="table-person"
                            href={path(kind, c.id)}
                          >
                            <Avatar name={c.name} index={i} />
                            <span>
                              <b>{c.name}</b>
                              <small>{c.sector}</small>
                            </span>
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
                            .join(", ") || "Not recorded"}
                        </td>
                        <td>{c.country}</td>
                        <td>{c.sector}</td>
                        <td>
                          <Status value={c.stage} />
                        </td>
                        <td>{c.teamSize}</td>
                        <td>{c.description || "—"}</td>
                        <td>
                          <Link
                            className="icon-button"
                            aria-label={`Open ${c.name}`}
                            href={path(kind, c.id)}
                          >
                            <ArrowUpRight size={17} />
                          </Link>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!count && (
              <Empty>
                No records match these filters. Try a different country, sector
                or search.
              </Empty>
            )}
          </div>
        </section>
      )}
    </>
  );
}
function FounderProfile({ id, edit }: { id: string; edit: Editor }) {
  const { state: s, path, viewer } = useWorkspace();
  const founder = s.founders.find((f) => f.id === id);
  if (!founder) return <Empty>Founder not found.</Empty>;
  const companies = s.memberships
    .filter((m) => m.founderId === id)
    .map((m) => s.companies.find((c) => c.id === m.companyId))
    .filter((c) => !!c);
  const sessions = profileSpaceWeeks(s, { founderId: id });
  return (
    <>
      <Link className="back-link" href={path("founders")}>
        <ArrowLeft size={16} />
        Founder directory
      </Link>
      <div className="profile-banner">
        <Avatar name={founder.name} />
        <div>
          <h1>{founder.name}</h1>
          <p>
            @{founder.xHandle} · {founder.country}
          </p>
        </div>
        {viewer.permissions.includes("directory.write") && (
          <button
            className="button"
            onClick={() =>
              edit("founder", founder as unknown as Record<string, unknown>)
            }
          >
            <Pencil size={15} />
            Edit founder
          </button>
        )}
        <DeleteRecordButton
          kind="founder"
          id={founder.id}
          name={founder.name}
          backTo={path("founders")}
        />
      </div>
      <FounderSpaces founderId={id} />
      <section className="panel padded">
        <h2>Founder details</h2>
        <dl className="facts">
          <div>
            <dt>Country</dt>
            <dd>{founder.country}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{founder.contact || "Not recorded"}</dd>
          </div>
          <div>
            <dt>Space appearances</dt>
            <dd>{sessions.length}</dd>
          </div>
          <div>
            <dt>Added</dt>
            <dd>{niceDate(founder.createdAt)}</dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <SectionHeading title="Companies" />
        {companies.map((company) => (
          <div key={company.id}>
            <Link className="entity-row" href={path("companies", company.id)}>
              <span className="entity-symbol">
                <Building2 size={19} />
              </span>
              <span>
                <b>{company.name}</b>
                <small>
                  {company.country} · {company.teamSize} people
                </small>
                <span className="profile-short-description">
                  {company.description}
                </span>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          </div>
        ))}
        {!companies.length && <Empty>No company added yet.</Empty>}
      </section>
    </>
  );
}
function CompanyProfile({ id, edit }: { id: string; edit: Editor }) {
  const { state: s, path, viewer } = useWorkspace();
  const company = s.companies.find((c) => c.id === id);
  if (!company) return <Empty>Company not found.</Empty>;
  const founders = s.memberships
    .filter((m) => m.companyId === id)
    .map((m) => s.founders.find((f) => f.id === m.founderId))
    .filter((f) => !!f);
  return (
    <>
      <Link className="back-link" href={path("companies")}>
        <ArrowLeft size={16} />
        Company directory
      </Link>
      <div className="profile-banner">
        <Avatar name={company.name} />
        <div>
          <h1>{company.name}</h1>
          <p>
            <MapPin size={14} />
            {company.country}
          </p>
          <ExternalLink href={company.website}>Company website</ExternalLink>
        </div>
        {viewer.permissions.includes("directory.write") && (
          <button
            className="button"
            onClick={() =>
              edit("company", company as unknown as Record<string, unknown>)
            }
          >
            <Pencil size={15} />
            Edit company
          </button>
        )}
      </div>
      <section className="panel padded">
        <h2>Short description</h2>
        <p>{company.description || "Not recorded"}</p>
        <dl className="facts">
          <div>
            <dt>Country</dt>
            <dd>{company.country}</dd>
          </div>
          <div>
            <dt>Team size</dt>
            <dd>{company.teamSize}</dd>
          </div>
          <div>
            <dt>Sector</dt>
            <dd>{company.sector}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{company.stage}</dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <SectionHeading title="Founders" />
        {founders.map((founder) => (
          <Link
            className="entity-row"
            key={founder.id}
            href={path("founders", founder.id)}
          >
            <Avatar name={founder.name} />
            <span>
              <b>{founder.name}</b>
              <small>
                @{founder.xHandle} · {founder.country}
              </small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </section>
      <FounderSpaces companyId={id} />
    </>
  );
}
