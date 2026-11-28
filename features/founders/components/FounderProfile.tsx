"use client";

import Link from "next/link";

import { ArrowLeft, ChevronRight, Pencil } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Avatar, Empty, ExternalLink } from "@/components/ui";
import ProjectDetails from "@/features/companies/components/ProjectDetails";
import DeleteRecordButton from "@/features/founders/components/DeleteRecordButton";
import FounderSpaces from "@/features/spaces/components/FounderSpaces";
import { niceDate } from "@/lib/dates/format";
import type { Resource } from "@/components/shared/RecordEditor";
type Editor = (resource: Resource, record?: Record<string, unknown>) => void;
export default function FounderProfile({
  id,
  edit,
}: {
  id: string;
  edit: Editor;
}) {
  const { state: s, path, viewer } = useWorkspace();
  const founder = s.founders.find((f) => f.id === id);
  if (!founder) return <Empty>Founder not found.</Empty>;
  const companies = s.memberships
    .filter((m) => m.founderId === id)
    .map((m) => s.companies.find((c) => c.id === m.companyId))
    .filter((c) => !!c);
  return (
    <div className="directory-profile">
      <Link className="back-link" href={path("founders")}>
        <ArrowLeft size={16} aria-hidden="true" />
        Founder directory
      </Link>
      <section
        className="panel padded directory-summary"
        aria-labelledby="founder-title"
      >
        <header className="directory-profile-header">
          <Avatar name={founder.name} />
          <div>
            <h1 id="founder-title">{founder.name}</h1>
            {founder.role && <p>{founder.role}</p>}
          </div>
        </header>
        <div className="directory-profile-block">
          <h2>{companies.length === 1 ? "Project" : "Projects"}</h2>
          {!companies.length && <p>No projects added yet.</p>}
          {companies.map((company) => (
            <div className="founder-project-details" key={company.id}>
              <h3>
                <Link
                  className="directory-project-name"
                  href={path("companies", company.id)}
                >
                  {company.name}
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              </h3>
              <ProjectDetails company={company} />
            </div>
          ))}
        </div>
        <div className="directory-profile-block">
          <h2>Founder details</h2>
          <dl className="directory-facts">
            <div>
              <dt>Country</dt>
              <dd>{founder.country}</dd>
            </div>
            <div>
              <dt>Personal X</dt>
              <dd>
                <ExternalLink href={`https://x.com/${founder.xHandle}`}>
                  @{founder.xHandle}
                </ExternalLink>
              </dd>
            </div>
            {founder.contact && (
              <div>
                <dt>Contact</dt>
                <dd>{founder.contact}</dd>
              </div>
            )}
            <div>
              <dt>Added</dt>
              <dd>{niceDate(founder.createdAt)}</dd>
            </div>
          </dl>
        </div>
        {viewer.permissions.includes("directory.write") && (
          <footer className="directory-profile-actions">
            <button className="button" onClick={() => edit("founder", founder)}>
              <Pencil size={15} aria-hidden="true" />
              Edit founder
            </button>
            <DeleteRecordButton
              kind="founder"
              id={founder.id}
              name={founder.name}
              backTo={path("founders")}
            />
          </footer>
        )}
      </section>
      <FounderSpaces founderId={id} />
    </div>
  );
}
