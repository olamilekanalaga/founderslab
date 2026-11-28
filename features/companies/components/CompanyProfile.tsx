"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Pencil } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Avatar, Empty } from "@/components/ui";
import FounderSpaces from "@/features/spaces/components/FounderSpaces";
import ProjectDetails from "./ProjectDetails";
import type { Resource } from "@/components/shared/RecordEditor";

export default function CompanyProfile({
  id,
  edit,
}: {
  id: string;
  edit: (resource: Resource, record?: Record<string, unknown>) => void;
}) {
  const { state, path, viewer } = useWorkspace();
  const company = state.companies.find((record) => record.id === id);
  if (!company) return <Empty>Company not found.</Empty>;

  const logoApplicationId = state.companyLogoApplicationIds?.[id];
  const team = state.memberships
    .filter((membership) => membership.companyId === id)
    .map(({ founderId, role }) => ({
      founder: state.founders.find((record) => record.id === founderId),
      role,
    }));

  return (
    <div className="directory-profile">
      <Link className="back-link" href={path("companies")}>
        <ArrowLeft size={16} aria-hidden="true" />
        Company directory
      </Link>
      <section
        className="panel padded directory-profile-overview"
        aria-labelledby="project-title"
      >
        <header className="directory-profile-header">
          <Avatar
            name={company.name}
            logo={
              logoApplicationId
                ? `/api/project-logo/${encodeURIComponent(logoApplicationId)}`
                : undefined
            }
          />
          <h1 id="project-title">{company.name}</h1>
        </header>
        <div className="directory-profile-block">
          <h2>About the project</h2>
          <ProjectDetails company={company} />
        </div>
        <div className="directory-profile-block">
          <h2>Founders</h2>
          {!team.some(({ founder }) => founder) && (
            <p>No founders added yet.</p>
          )}
          {team.map(
            ({ founder, role }) =>
              founder && (
                <Link
                  className="entity-row"
                  key={founder.id}
                  href={path("founders", founder.id)}
                >
                  <Avatar name={founder.name} />
                  <span>
                    <b>{founder.name}</b>
                    {role && <small>{role}</small>}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ),
          )}
        </div>
        {viewer.permissions.includes("directory.write") && (
          <footer className="directory-profile-actions">
            <button className="button" onClick={() => edit("company", company)}>
              <Pencil size={15} aria-hidden="true" />
              Edit company
            </button>
          </footer>
        )}
      </section>
      <FounderSpaces companyId={id} />
    </div>
  );
}
