"use client";

import Link from "next/link";

import { ArrowUpRight, ArrowLeft, Pencil, Building2 } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Avatar, Empty, SectionHeading } from "@/components/ui";
import { profileSpaceWeeks } from "@/lib/space-data";
import DeleteRecordButton from "@/features/founders/components/DeleteRecordButton";
import FounderSpaces from "@/features/spaces/components/FounderSpaces";
import { niceDate } from "@/lib/selectors";
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
