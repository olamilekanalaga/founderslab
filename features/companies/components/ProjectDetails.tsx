import { ExternalLink } from "@/components/ui";
import { chainNames } from "@/lib/chains";
import type { CompanyRow } from "@/lib/types";

export default function ProjectDetails({ company }: { company: CompanyRow }) {
  const facts = [
    ["Sector", company.sector],
    ["Stage", company.stage],
    ["Country", company.country],
    [
      "Team size",
      company.teamSize === "1"
        ? "1 person"
        : company.teamSize && `${company.teamSize} people`,
    ],
    ["Chain", chainNames(company.chains).join(", ")],
    [
      "Hiring?",
      company.hiringStatus === "Hiring"
        ? "Yes"
        : company.hiringStatus === "Unknown"
          ? ""
          : company.hiringStatus,
    ],
  ].filter(([, value]) => value);

  return (
    <>
      <p className="directory-description">
        {company.description || "No description added yet."}
      </p>
      {(company.website || company.xHandle) && (
        <div className="directory-profile-links">
          <ExternalLink href={company.website}>Website</ExternalLink>
          {company.xHandle && (
            <ExternalLink href={`https://x.com/${company.xHandle}`}>
              @{company.xHandle} on X
            </ExternalLink>
          )}
        </div>
      )}
      {facts.length > 0 && (
        <dl className="directory-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
