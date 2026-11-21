import countries from "i18n-iso-countries";
import english from "i18n-iso-countries/langs/en.json";
countries.registerLocale(english);
export const COUNTRIES = Object.values(
  countries.getNames("en", { select: "official" }),
).sort();
export const SECTORS = [
  "Payments",
  "DeFi",
  "Infrastructure",
  "Identity",
  "Gaming",
  "Consumer",
  "Climate",
  "Education",
  "Creator economy",
  "Security",
];
export const STAGES = [
  "Idea",
  "Prototype",
  "MVP",
  "Early traction",
  "Growth",
  "Mature",
];
export const TEAM_SIZES = ["1", "2–5", "6–10", "11–25", "26+"];
export const FUNCTIONS = [
  "Payments processing",
  "Lending",
  "Analytics",
  "Identity verification",
  "Developer tooling",
  "Distribution",
  "Asset management",
  "Community",
  "Education",
  "Security",
];
export const NEEDS = [
  "Distribution",
  "Data analytics",
  "Hiring",
  "Funding",
  "Compliance",
  "Integrations",
  "Partnerships",
  "Research",
  "Market entry",
];
export const RELATIONS = [
  "Direct competitor",
  "Indirect competitor",
  "Substitute",
  "Complement",
  "Potential integration",
  "Supplier/customer",
  "Distribution partner",
  "Ecosystem partner",
];
export const OPPORTUNITY_TYPES = [
  "Employment",
  "Consulting",
  "Growth campaign",
  "Research contract",
  "Data analytics",
  "Business development",
  "Talent matching",
  "Integration",
  "Partnership",
  "Market entry",
  "Sponsorship",
];
export const PIPELINE = [
  "Discovered",
  "Researching",
  "Qualified",
  "Contacted",
  "Meeting",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
  "Not a fit",
];
export const BOOKING_STATUSES = [
  "Pending",
  "Approved",
  "Waitlisted",
  "Declined",
  "Cancelled",
  "Attended",
  "No-show",
];
export const CONFIDENCE = ["Low", "Medium", "High"];
export const VERIFICATION = [
  "Unverified",
  "Self-reported",
  "Evidence reviewed",
  "Verified",
];
export const RESEARCH_SECTIONS = [
  "Founder origin and motivation",
  "Product and customer",
  "Market and alternatives",
  "Distribution and growth",
  "User behaviour",
  "Data and decision-making",
  "Business challenges",
  "Team and talent needs",
  "Integration and partnership needs",
  "Next milestones",
  "Researcher observations",
  "Follow-up questions",
];
export const PERMISSIONS = [
  "directory.read",
  "directory.write",
  "booking.read",
  "booking.write",
  "research.read",
  "research.write",
  "commercial.read",
  "commercial.write",
  "reports.read",
  "campaign.read",
  "campaign.write",
  "team.manage",
] as const;
export const ROLES: Record<string, { name: string; permissions: string[] }> = {
  admin: { name: "Admin", permissions: [...PERMISSIONS] },
  researcher: {
    name: "Researcher",
    permissions: [
      "directory.read",
      "research.read",
      "research.write",
      "booking.read",
      "reports.read",
    ],
  },
  coordinator: {
    name: "Booking coordinator",
    permissions: ["directory.read", "booking.read", "booking.write"],
  },
  host: {
    name: "Interview host",
    permissions: [
      "directory.read",
      "booking.read",
      "booking.write",
      "research.read",
      "research.write",
    ],
  },
  development: {
    name: "Business development",
    permissions: [
      "directory.read",
      "research.read",
      "commercial.read",
      "commercial.write",
      "reports.read",
    ],
  },
  analyst: {
    name: "Read-only analyst",
    permissions: ["directory.read", "research.read", "reports.read"],
  },
};
export const defaultSettings = {
  countryOptions: COUNTRIES,
  capacity: 5,
  retentionDays: 365,
  campaignTarget: 20,
  awardAmount: "1 SOL",
  terms:
    "Participation is free and subject to review. The monthly programme targets 20 founders; capacity and selection are not guaranteed. One eligible founder may receive 1 SOL after human review against published criteria. No fee, investment or token purchase is required. Conflicts of interest must be disclosed. The award does not endorse a company or promise financial returns. No automatic cryptocurrency payments. Decisions and any transfer reference are recorded separately. Founder information is private unless separately approved for publication.",
};
export function allowed(permissions: string[], key: string) {
  return permissions.includes(key);
}
export function actionPermission(type: string) {
  const map: Record<string, string> = {
    "founder.save": "directory.write",
    "company.save": "directory.write",
    "application.review": "booking.write",
    "booking.create": "booking.write",
    "booking.review": "booking.write",
    "session.save": "booking.write",
    "research.save": "research.write",
    "need.save": "research.write",
    "relationship.save": "research.write",
    "opportunity.save": "commercial.write",
    "campaign.save": "campaign.write",
    "campaign.assess": "campaign.write",
    "award.save": "campaign.write",
    "taxonomy.save": "team.manage",
    "settings.save": "team.manage",
    "invite.create": "team.manage",
    "user.permissions": "team.manage",
  };
  return map[type];
}

export const countryCode = (name: string) =>
  countries.getAlpha2Code(name, "en") || name.slice(0, 2).toUpperCase();

/** Geographic groups for the overview; all other regions remain explicitly grouped as Other. */
export function countryRegion(name: string) {
  const code = countries.getAlpha2Code(name, "en") || "";
  if (
    "DZ AO BJ BW BF BI CV CM CF TD KM CG CD DJ EG GQ ER SZ ET GA GM GH GN GW CI KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW EH RE YT SH IO TF"
      .split(" ")
      .includes(code)
  )
    return "Africa";
  if (
    "AL AD AT BY BE BA BG HR CY CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB AX"
      .split(" ")
      .includes(code)
  )
    return "Europe";
  if (
    "AG AI AW BS BB BZ BM BQ CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VG VI"
      .split(" ")
      .includes(code)
  )
    return "North America";
  return "Other";
}
