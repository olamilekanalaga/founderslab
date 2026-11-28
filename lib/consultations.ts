import { z } from "zod";

export const followUpStatuses = [
  "Not started",
  "Opportunity identified",
  "Private session offered",
  "Follow-up sent",
  "Declined or closed",
] as const;

export const followUpLabels = {
  problems: "Business problems identified",
  knowledgeGaps: "Knowledge gaps",
  economicImpact: "Potential economic impact",
  observations: "Supporting observations",
  investigationAreas: "Proposed investigation areas",
  recommendation: "Private consultation recommendation",
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
  "Commercial discussion",
  "Proposal submitted",
  "Hired or contract secured",
  "Declined or closed",
] as const;

export const stageLabels = [
  "Space booked",
  "Space completed",
  "Business opportunity identified",
  "Private session offered",
  "Private session booked",
  "Payment received",
  "Private session completed",
  ...engagementStatuses,
] as const;
export type PipelineStage = (typeof stageLabels)[number];

const date = z.iso.date();
const text = z.string().trim().max(8_000);
const money = z.number().int().nonnegative().max(1_000_000_000);
export const maxConsultationFeePence = 99_999_999;
export const clinicSettings = z.object({
  feePence: money
    .min(30, "Enter a fee of at least £0.30.")
    .max(maxConsultationFeePence),
  durationMinutes: z.number().int().min(15).max(480),
});
export const engagementSchema = z.object({
  type: z.enum(engagementTypes),
  problem: text.min(1),
  solution: text,
  estimatedPence: money.nullable(),
  agreedPence: money.nullable(),
  status: z.enum(engagementStatuses),
  followUpOn: date.nullable(),
  outcome: text,
});

export const consultationSettingsKey = "private-consultation";
export const consultationPath = "/private-session";

export function consultationLink(invite: string) {
  return new URL(`${consultationPath}#token=${invite}`, location.origin).href;
}

export function gbp(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
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
