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
  Link2,
  Users,
  LayoutGrid,
  List,
} from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";
import {
  Avatar,
  Status,
  Empty,
  SectionHeading,
  Evidence,
  ExternalLink,
} from "./ui";
import { founderSessions, companySessions } from "@/lib/domain";
import { niceDate, dateTime } from "@/lib/selectors";
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
    [label, setLabel] = useState(""),
    [view, setView] = useState("cards"),
    [page, setPage] = useState(0);
  if (id)
    return kind === "founders" ? (
      <FounderProfile id={id} edit={edit} />
    ) : (
      <CompanyProfile id={id} edit={edit} />
    );
  const companies = s.companies.filter(
    (c) =>
      (!sector || c.sector === sector) &&
      (!stage || c.stage === stage) &&
      (!label ||
        s.companyLabels.some(
          (l) => l.companyId === c.id && l.labelId === label,
        )),
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
      ((!sector && !stage && !label) ||
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
            {kind === "founders" ? "Founder directory" : "Company intelligence"}
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
        <select
          aria-label="Filter classification label"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All labels</option>
          {s.labels
            .filter((l) => l.active)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.group}: {l.name}
              </option>
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
                  <th>{kind === "founders" ? "Relationship" : "Stage"}</th>
                  {kind === "companies" && (
                    <>
                      <th>Team</th>
                      <th>Needs</th>
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
                            <Status value={f.relationshipStatus} />
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
                              <small>
                                {c.economicFunctions.join(" · ") ||
                                  "Function not classified"}
                              </small>
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
                        <td>
                          <div className="table-tags">
                            {s.needs
                              .filter((n) => n.companyId === c.id)
                              .slice(0, 2)
                              .map((n) => (
                                <span className="tag" key={n.id}>
                                  {n.kind}
                                </span>
                              ))}
                          </div>
                        </td>
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
  const f = s.founders.find((v) => v.id === id);
  if (!f) return <Empty>Founder not found.</Empty>;
  const membership = s.memberships.filter((m) => m.founderId === id),
    sessions = founderSessions(s, id),
    research = s.research.filter((r) => r.founderId === id),
    needs = s.needs.filter((n) =>
      membership.some((m) => m.companyId === n.companyId),
    );
  return (
    <>
      <Link className="back-link" href={path("founders")}>
        <ArrowLeft size={16} /> Founder directory
      </Link>
      <div className="profile-banner">
        <Avatar name={f.name} />
        <div>
          <h1>{f.name}</h1>
          <p>
            {f.role} · @{f.xHandle} · {f.country}
          </p>
          <div className="inline">
            <Status value={f.relationshipStatus} />
            <Status value={f.verification} />
          </div>
        </div>
        {viewer.permissions.includes("directory.write") && (
          <button
            className="button"
            onClick={() =>
              edit("founder", f as unknown as Record<string, unknown>)
            }
          >
            <Pencil size={15} /> Edit founder
          </button>
        )}
      </div>
      <div className="profile-grid">
        <div className="stack">
          <section className="panel">
            <SectionHeading title="The companies they’re building" />
            {membership.map((m) => {
              const c = s.companies.find((v) => v.id === m.companyId);
              return c ? (
                <Link
                  className="entity-row"
                  key={c.id}
                  href={path("companies", c.id)}
                >
                  <span className="entity-symbol">
                    <Building2 size={19} />
                  </span>
                  <span>
                    <b>{c.name}</b>
                    <small>
                      {m.role} · {c.stage} · {c.teamSize} people
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ) : null;
            })}
            {!membership.length && (
              <Empty>No company relationships recorded.</Empty>
            )}
          </section>
          <section className="panel">
            <SectionHeading
              title="Space appearances & recordings"
              detail="Recording links come directly from each shared session."
            />
            {sessions.map(({ session, participation }) => (
              <div key={participation.id} className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <Link className="text-link" href={path("spaces", session.id)}>
                    {session.title}
                    <ArrowUpRight size={14} />
                  </Link>
                  <small>
                    {dateTime(session.startsAt, session.timezone)} ·{" "}
                    {session.timezone}
                  </small>
                  <div className="inline">
                    <Status value={participation.attendance} />
                    <ExternalLink href={session.recordingUrl}>
                      Session recording
                    </ExternalLink>
                  </div>
                </div>
              </div>
            ))}
            {!sessions.length && <Empty>No approved appearances yet.</Empty>}
          </section>
          <section className="panel">
            <SectionHeading
              title="Research notes"
              action={
                viewer.permissions.includes("research.read") ? (
                  <Link
                    className="text-link"
                    href={path("research") + `?founder=${id}`}
                  >
                    Open research <ArrowUpRight size={14} />
                  </Link>
                ) : null
              }
            />
            {research.map((r) => (
              <div className="note-row" key={r.id}>
                <div className="row-between">
                  <b>{s.sessions.find((v) => v.id === r.sessionId)?.title}</b>
                  <Status value={r.status} />
                </div>
                <p>
                  {s.answers.find(
                    (a) =>
                      a.researchId === r.id &&
                      a.section === "Researcher observations",
                  )?.response || "No observation recorded."}
                </p>
                <small>
                  {r.researcher} · {niceDate(r.recordedAt)} · {r.confidence}{" "}
                  confidence
                </small>
              </div>
            ))}
            {!research.length && (
              <Empty>No research records available to this role.</Empty>
            )}
          </section>
        </div>
        <aside className="stack">
          <section className="panel padded">
            <h2>Relationship details</h2>
            <dl className="facts">
              <div>
                <dt>Country</dt>
                <dd>{f.country}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>
                  {f.contact || "Not recorded or not shared with this role"}
                </dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{f.source}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{niceDate(f.createdAt)}</dd>
              </div>
            </dl>
            <h3>Follow-up</h3>
            <p>{f.followUp || "No follow-up set."}</p>
            <h3>Internal notes</h3>
            <p>{f.notes || "No internal notes yet."}</p>
          </section>
          <section className="panel padded">
            <h2>Identified needs</h2>
            {needs.map((n) => (
              <div className="compact-note" key={n.id}>
                <b>{n.kind}</b>
                <p>{n.description}</p>
                <Status value={n.verification} />
              </div>
            ))}
            {!needs.length && <p>No needs documented.</p>}
          </section>
          <section className="panel padded">
            <h2>Application history</h2>
            {s.applications
              .filter((a) => a.founderId === id)
              .map((a) => (
                <div className="compact-note" key={a.id}>
                  <b>{a.reference}</b>
                  <p>{a.companyName}</p>
                  <Status value={a.status} />
                </div>
              ))}
          </section>
        </aside>
      </div>
    </>
  );
}
function CompanyProfile({ id, edit }: { id: string; edit: Editor }) {
  const { state: s, path, viewer } = useWorkspace();
  const c = s.companies.find((v) => v.id === id);
  if (!c) return <Empty>Company not found.</Empty>;
  const membership = s.memberships.filter((m) => m.companyId === id),
    sessions = companySessions(s, id),
    relationships = s.relationships.filter(
      (r) => r.companyAId === id || r.companyBId === id,
    );
  return (
    <>
      <Link className="back-link" href={path("companies")}>
        <ArrowLeft size={16} /> Company directory
      </Link>
      <div className="profile-banner">
        <Avatar name={c.name} />
        <div>
          <h1>{c.name}</h1>
          <p>
            <MapPin size={14} /> {c.country} · {c.stage} · {c.teamSize} people
          </p>
          <ExternalLink href={c.website}>Company website</ExternalLink>
        </div>
        {viewer.permissions.includes("directory.write") && (
          <button
            className="button"
            onClick={() =>
              edit("company", c as unknown as Record<string, unknown>)
            }
          >
            <Pencil size={15} /> Edit company
          </button>
        )}
      </div>
      <div className="profile-grid">
        <div className="stack">
          <section className="panel padded">
            <h2>Product & market</h2>
            <p>{c.description}</p>
            <div className="classification-grid">
              {[
                ["Sector", [c.sector]],
                ["Economic functions", c.economicFunctions],
                ["Customers", c.customers],
                ["Business models", c.businessModels],
                ["Ecosystems", c.ecosystems],
                ["Supported chains", c.chains],
                ["Operating markets", c.operatingCountries],
                ["Distribution channels", c.distribution],
                ["Current integrations", c.integrations],
              ].map(([label, values]) => (
                <div key={String(label)}>
                  <h3>{label}</h3>
                  <div className="tags">
                    {(values as string[]).length ? (
                      (values as string[]).map((v) => (
                        <span className="tag" key={v}>
                          {v}
                        </span>
                      ))
                    ) : (
                      <small>Not recorded</small>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="tags">
              {s.companyLabels
                .filter((l) => l.companyId === id)
                .map((l) => (
                  <span className="tag" key={l.labelId}>
                    {s.labels.find((v) => v.id === l.labelId)?.name}
                  </span>
                ))}
            </div>
          </section>
          <section className="panel">
            <SectionHeading title="People behind the company" />
            {membership.map((m) => {
              const f = s.founders.find((v) => v.id === m.founderId);
              return f ? (
                <Link
                  key={f.id}
                  className="entity-row"
                  href={path("founders", f.id)}
                >
                  <Avatar name={f.name} />
                  <span>
                    <b>{f.name}</b>
                    <small>
                      {m.role} · {f.country}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </Link>
              ) : null;
            })}
          </section>
          <section className="panel">
            <SectionHeading
              title="Session timeline"
              detail="One recording on a session, available across every linked profile."
            />
            {sessions.map((session) => (
              <div key={session.id} className="timeline-item">
                <span className="timeline-dot" />
                <div>
                  <Link className="text-link" href={path("spaces", session.id)}>
                    {session.title}
                  </Link>
                  <small>
                    {dateTime(session.startsAt, session.timezone)} ·{" "}
                    {session.timezone}
                  </small>
                  <ExternalLink href={session.recordingUrl}>
                    Shared session recording
                  </ExternalLink>
                </div>
              </div>
            ))}
            {!sessions.length && <Empty>No approved sessions yet.</Empty>}
          </section>
        </div>
        <aside className="stack">
          <section className="panel padded">
            <h2>Business needs</h2>
            <p>{c.challenges || "No challenges reported."}</p>
            {s.needs
              .filter((n) => n.companyId === id)
              .map((n) => (
                <div className="compact-note" key={n.id}>
                  <b>{n.kind}</b>
                  <p>{n.description}</p>
                  <Evidence
                    source={n.evidence}
                    confidence={n.confidence}
                    verification={n.verification}
                  />
                </div>
              ))}
          </section>
          <section className="panel padded">
            <h2>
              <Users size={16} /> Team & talent
            </h2>
            <p>{c.teamSize} people</p>
            <Status
              value={
                c.hiringStatus === "Hiring" && c.hiringEvidence
                  ? "Hiring signal"
                  : c.hiringStatus === "Not hiring"
                    ? "Not hiring"
                    : "Hiring unknown"
              }
            />
            {c.hiringEvidence && <p>{c.hiringEvidence}</p>}
          </section>
          <section className="panel padded">
            <h2>
              <Link2 size={16} /> Company relationships
            </h2>
            {relationships.map((r) => (
              <div className="compact-note" key={r.id}>
                <b>
                  {
                    s.companies.find(
                      (v) =>
                        v.id ===
                        (r.companyAId === id ? r.companyBId : r.companyAId),
                    )?.name
                  }
                </b>
                <p>{r.type}</p>
                <small>
                  {r.verification === "Verified"
                    ? "Verified relationship"
                    : "Hypothesis · validate with founders"}
                </small>
              </div>
            ))}
            {!relationships.length && (
              <p>
                No explicit relationships recorded. A shared sector alone does
                not imply competition.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
