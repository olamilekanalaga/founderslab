import type { Section } from "./types";
export const SECTION_PERMISSIONS: Record<Section, string> = {
  dashboard: "directory.read",
  founders: "directory.read",
  companies: "directory.read",
  spaces: "booking.read",
  research: "research.read",
  "market-map": "research.read",
  opportunities: "commercial.read",
  reports: "reports.read",
  campaigns: "campaign.read",
  settings: "team.manage",
};
