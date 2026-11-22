import type { Section } from "@/lib/types";
export const SECTION_PERMISSIONS: Record<Section, string> = {
  dashboard: "directory.read",
  founders: "directory.read",
  companies: "directory.read",
  spaces: "booking.read",
  "space-data": "booking.read",
  classification: "directory.read",
  research: "research.read",
  "market-map": "research.read",
  opportunities: "commercial.read",
  reports: "reports.read",
  campaigns: "campaign.read",
  settings: "team.manage",
};
