import type {
  Founder,
  Company,
  FounderCompanyMembership,
  Application,
  Session,
  SpaceData,
  SpaceTeamAttendance,
  SessionParticipant,
  BookingRequest,
  ResearchRecord,
  ResearchAnswer,
  ClassificationLabel,
  CompanyLabel,
  BusinessNeed,
  CompanyRelationship,
  Opportunity,
  OpportunityActivity,
  Campaign,
  CampaignParticipant,
  AwardDecision,
  AuditLog,
} from "@prisma/client";
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
export type Person = Serialized<Founder>;
export type CompanyRow = Serialized<Company>;
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  roleId: string;
  active: boolean;
  permissions: string[];
}
export interface InviteRow {
  id: string;
  email: string;
  name: string;
  roleId: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}
export interface Settings {
  countryOptions: string[];
  capacity: number;
  retentionDays: number;
  campaignTarget: number;
  awardAmount: string;
  terms: string;
}
export interface DataState {
  programmeSessionIds?: string[];
  version: 1;
  fictional?: boolean;
  founders: Person[];
  companies: CompanyRow[];
  companyLogoApplicationIds?: Record<string, string>;
  memberships: Serialized<FounderCompanyMembership>[];
  applications: Serialized<
    Omit<
      Application,
      | "dedupeKey"
      | "confirmationHash"
      | "confirmationExpires"
      | "discussionPreference"
      | "publicSpaceConsentAt"
    > & {
      hasProjectLogo?: boolean;
      discussionPreference?: string | null;
      publicSpaceConsentAt?: Date | null;
    }
  >[];
  sessions: Serialized<Session>[];
  participants: Serialized<SessionParticipant>[];
  spaceData: Serialized<SpaceData>[];
  spaceAttendance: Serialized<SpaceTeamAttendance>[];
  bookings: Serialized<BookingRequest>[];
  research: Serialized<ResearchRecord>[];
  answers: Serialized<ResearchAnswer>[];
  labels: Serialized<ClassificationLabel>[];
  companyLabels: Serialized<CompanyLabel>[];
  needs: Serialized<BusinessNeed>[];
  relationships: Serialized<CompanyRelationship>[];
  opportunities: Serialized<Opportunity>[];
  activities: Serialized<OpportunityActivity>[];
  campaigns: Serialized<Campaign>[];
  campaignParticipants: Serialized<CampaignParticipant>[];
  awards: Serialized<AwardDecision>[];
  audit: Serialized<AuditLog>[];
  users: TeamMember[];
  invitations: InviteRow[];
  settings: Settings;
}
export interface Viewer {
  id: string;
  name: string;
  email: string;
  roleId: string;
  permissions: string[];
  csrf?: string;
  profilePhoto?: string;
}
export interface Command {
  type: string;
  payload: Record<string, unknown>;
}
export type Section =
  | "owner-invitations"
  | "operations"
  | "dashboard"
  | "founders"
  | "companies"
  | "spaces"
  | "space-data"
  | "classification"
  | "research"
  | "market-map"
  | "opportunities"
  | "reports"
  | "settings";
export const SECTIONS: Section[] = [
  "owner-invitations",
  "operations",
  "dashboard",
  "founders",
  "companies",
  "research",
  "spaces",
  "reports",
  "settings",
];
