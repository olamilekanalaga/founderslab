"use client";

import Link from "next/link";

import { ArrowUpRight, MapPin, ArrowLeft, Pencil } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Avatar, Empty, SectionHeading, ExternalLink } from "@/components/ui";

import FounderSpaces from "@/features/spaces/components/FounderSpaces";
import { chainNames } from "@/lib/chains";

import type { Resource } from "@/components/shared/RecordEditor";
type Editor = (resource: Resource, record?: Record<string, unknown>) => void;
export default function CompanyProfile({
  id,
  edit,
}: {
  id: string;
  edit: Editor;
}) {
  const { state: s, path, viewer } = useWorkspace();
  const company = s.companies.find((c) => c.id === id);
  if (!company) return <Empty>Company not found.</Empty>;
  const logoApplicationId = s.companyLogoApplicationIds?.[id];
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
        <Avatar
          name={company.name}
          logo={
            logoApplicationId
              ? `/api/project-logo/${encodeURIComponent(logoApplicationId)}`
              : undefined
          }
        />
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
            <dt>Project X</dt>
            <dd>
              {company.xHandle ? (
                <ExternalLink href={`https://x.com/${company.xHandle}`}>
                  @{company.xHandle}
                </ExternalLink>
              ) : (
                "Not provided"
              )}
            </dd>
          </div>
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
          <div>
            <dt>Chain</dt>
            <dd>{chainNames(company.chains).join(", ") || "Not recorded"}</dd>
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
                Founder X: @{founder.xHandle} · {founder.country}
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
