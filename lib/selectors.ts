import type { DataState } from "./types";
export interface Filters {
  country: string;
  sector: string;
  stage: string;
  cohort: string;
  from: string;
  to: string;
}
export const blankFilters: Filters = {
  country: "",
  sector: "",
  stage: "",
  cohort: "",
  from: "",
  to: "",
};
export function groupBy(values: string[]) {
  const result = new Map<string, number>();
  for (const value of values) {
    const key = value || "Not recorded";
    result.set(key, (result.get(key) || 0) + 1);
  }
  return [...result]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
export function reportData(s: DataState, filters: Filters) {
  const campaignIds = filters.cohort
    ? s.campaignParticipants
        .filter((p) => p.campaignId === filters.cohort)
        .map((p) => p.founderId)
    : null;
  const founders = s.founders.filter(
    (f) =>
      (!filters.country || f.country === filters.country) &&
      (!campaignIds || campaignIds.includes(f.id)) &&
      (!filters.from || f.createdAt >= filters.from) &&
      (!filters.to || f.createdAt <= filters.to + "T23:59:59.999Z") &&
      ((!filters.sector && !filters.stage) ||
        s.memberships.some(
          (m) =>
            m.founderId === f.id &&
            s.companies.some(
              (c) =>
                c.id === m.companyId &&
                (!filters.sector || c.sector === filters.sector) &&
                (!filters.stage || c.stage === filters.stage),
            ),
        )),
  );
  const founderIds = new Set(founders.map((f) => f.id));
  const companyIds = new Set(
    s.memberships
      .filter((m) => founderIds.has(m.founderId))
      .map((m) => m.companyId),
  );
  const companies = s.companies.filter(
    (c) =>
      companyIds.has(c.id) &&
      (!filters.sector || c.sector === filters.sector) &&
      (!filters.stage || c.stage === filters.stage),
  );
  const selectedCompanies = new Set(companies.map((c) => c.id));
  const research = s.research.filter(
    (r) => founderIds.has(r.founderId) && selectedCompanies.has(r.companyId),
  );
  const needs = s.needs.filter((n) => selectedCompanies.has(n.companyId));
  const opportunities = s.opportunities.filter((o) =>
    selectedCompanies.has(o.companyId),
  );
  const covered = new Set(
    research.filter((r) => r.status === "Complete").map((r) => r.founderId),
  ).size;
  return {
    founders,
    companies,
    research,
    needs,
    opportunities,
    covered,
    countries: groupBy(founders.map((f) => f.country)),
    sectors: groupBy(companies.map((c) => c.sector)),
    stages: groupBy(companies.map((c) => c.stage)),
    teams: groupBy(companies.map((c) => c.teamSize)),
    distribution: groupBy(companies.flatMap((c) => c.distribution)),
    businessNeeds: groupBy(needs.map((n) => n.kind)),
    pipeline: groupBy(opportunities.map((o) => o.status)),
    integrations: s.relationships.filter(
      (r) =>
        selectedCompanies.has(r.companyAId) &&
        r.type === "Potential integration",
    ),
    partnerships: s.relationships.filter(
      (r) =>
        selectedCompanies.has(r.companyAId) &&
        ["Distribution partner", "Ecosystem partner", "Complement"].includes(
          r.type,
        ),
    ),
    hiring: companies.filter(
      (c) => c.hiringStatus === "Hiring" && c.hiringEvidence.trim(),
    ),
    missing: {
      companyProfiles: founders.filter(
        (f) => !s.memberships.some((m) => m.founderId === f.id),
      ).length,
      customerSegment: companies.filter((c) => !c.customers.length).length,
      businessModel: companies.filter((c) => !c.businessModels.length).length,
      distribution: companies.filter((c) => !c.distribution.length).length,
      completedResearch: founders.length - covered,
    },
  };
}
export function growthData(s: DataState) {
  let total = 0;
  return groupBy(s.founders.map((f) => f.createdAt.slice(0, 7)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => ({
      name: new Date(v.name + "-02").toLocaleDateString("en", {
        month: "short",
      }),
      value: (total += v.value),
      added: v.value,
    }));
}
export const dateTime = (date: string, timezone = "Africa/Lagos") =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(date));
export const niceDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
