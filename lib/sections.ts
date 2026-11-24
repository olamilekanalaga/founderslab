import type { Section } from "@/lib/types";
export const SECTION_PERMISSIONS: Record<Section, string> = {
  "owner-invitations": "team.manage",
  operations: "booking.write",
  "bd-performance": "booking.write",
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
  settings: "directory.read",
};
