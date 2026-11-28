import { z } from "zod";

export const followUpStatuses = [
  "Not started",
  "Opportunity identified",
  "Private session offered",
  "Follow-up sent",
  "Declined or closed",
] as const;

export const followUpLabels = {
  problems: "Observed business problems",
  knowledgeGaps: "Knowledge gaps",
  opportunities: "Possible opportunities",
  observations: "Supporting evidence",
  economicImpact: "Potential business impact",
  investigationAreas: "Proposed investigation areas",
  contribution: "My proposed contribution",
  message: "Personalised follow-up message",
} as const;

export type FollowUpField = keyof typeof followUpLabels;
export const followUpSchema = z.partialRecord(
  z.enum(Object.keys(followUpLabels) as FollowUpField[]),
  z.string().trim().max(8_000),
);
export type FollowUp = z.infer<typeof followUpSchema>;

export const engagementTypes = [
  "Full-time employment",
  "Part-time employment",
  "Research contract",
  "Consulting contract",
  "Software development",
  "Business automation",
  "Growth and partnerships",
  "Monthly retainer",
  "Other",
] as const;

export const engagementStatuses = [
  "No immediate opportunity",
  "Further research required",
  "Follow-up needed",
  "Partnership discussion",
  "Consulting opportunity",
  "Contract proposal",
  "Employment opportunity",
  "Secured contract",
  "Secured employment",
  "Declined or closed",
] as const;

export const relationshipSources = ["Inbound", "Outbound"] as const;
export const relationshipName = z.string().trim().min(1).max(180);
export const privateSessionRequestSchema = z.object({
  founderName: relationshipName,
  businessName: relationshipName,
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  context: z.string().trim().min(1).max(2_000),
});

export const stageLabels = [
  "Space booked",
  "Space completed",
  "Business opportunity identified",
  "Private session requested",
  "Private session offered",
  "Private session booked",
  "Private session completed",
  ...engagementStatuses,
] as const;
export type PipelineStage = (typeof stageLabels)[number];

const date = z.iso.date();
const text = z.string().trim().max(8_000);
const contractValue = z.number().int().nonnegative().max(1_000_000_000);
export const sessionSettings = z.object({
  durationMinutes: z.number().int().min(15).max(480),
});
export const engagementSchema = z.object({
  type: z.enum(engagementTypes).nullable(),
  problem: text,
  solution: text,
  estimatedPence: contractValue.nullable(),
  agreedPence: contractValue.nullable(),
  status: z.enum(engagementStatuses),
  followUpOn: date.nullable(),
  outcome: text,
});

export const consultationSettingsKey = "private-consultation";
export const consultationPath = "/private-session";

export function consultationLink(invite: string) {
  return new URL(`${consultationPath}#token=${invite}`, location.origin).href;
}

export function pence(value: string) {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) return NaN;
  const [pounds, fraction = ""] = value.trim().split(".");
  return Number(pounds) * 100 + Number(fraction.padEnd(2, "0"));
}

export function consultationTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}
