import { z } from "zod";

export const discoveryAreas = [
  "Customer acquisition",
  "Revenue and monetisation",
  "Customer behaviour",
  "Business operations",
  "Partnerships and distribution",
  "Data and analytics",
  "Software and automation",
  "New business opportunities",
] as const;

export const discoveryQuestions = {
  targetCustomers: "Who are your target customers?",
  revenueModel: "How does your business generate revenue?",
  challenges: "What are your biggest business challenges?",
  previousAttempts: "What have you already tried?",
  desiredOutcomes: "What would a successful solution look like?",
} as const;

export const researchAcknowledgements = {
  researchConsent:
    "I understand that Founders Lab involves independent business research and a live discussion of proposed solutions.",
  discussionConsent:
    "I agree to discuss approved business information publicly during the Space.",
} as const;

export const discoveryTextLimit = 4_000;
const answer = z
  .string()
  .trim()
  .min(1, "Add a short answer.")
  .max(discoveryTextLimit);
export const discoveryAnswersSchema = z.object({
  targetCustomers: answer,
  revenueModel: answer,
  challenges: answer,
  previousAttempts: answer,
  desiredOutcomes: answer,
  areas: z
    .array(z.enum(discoveryAreas))
    .min(1, "Choose at least one area.")
    .max(discoveryAreas.length)
    .transform((values) => [...new Set(values)]),
  researchConsent: z.literal(true, {
    error: "Acknowledge the research format.",
  }),
  discussionConsent: z.literal(true, {
    error: "Acknowledge the public discussion format.",
  }),
});
export const businessDiscoverySchema = discoveryAnswersSchema.extend({
  businessDescription: z
    .string()
    .trim()
    .min(1, "Describe what you are building.")
    .max(5_000),
});
export type BusinessDiscovery = z.infer<typeof businessDiscoverySchema>;

export const researchStatuses = [
  "Pending",
  "In progress",
  "Research ready",
  "Space completed",
  "Follow-up required",
  "Completed",
] as const;
export const researchStatusSchema = z.enum(researchStatuses);
export const researchNoteLabels = {
  researchNotes: "Research notes",
  identifiedProblems: "Identified problems",
  hypotheses: "Hypotheses",
  proposedSolutions: "Proposed solutions",
  validationMethods: "Data validation methods",
  discussionNotes: "Space discussion notes",
  followUpActions: "Follow-up actions",
  commercialOpportunities: "Potential commercial opportunities",
} as const;
export type ResearchNote = keyof typeof researchNoteLabels;
export const researchNoteSchema = z.partialRecord(
  z.enum(Object.keys(researchNoteLabels) as ResearchNote[]),
  z.string().trim().max(8_000),
);
export type ResearchNotes = z.infer<typeof researchNoteSchema>;

export function readDiscovery(form: FormData) {
  return {
    ...Object.fromEntries(
      Object.keys(discoveryQuestions).map((key) => [key, form.get(key)]),
    ),
    areas: form.getAll("areas"),
    researchConsent: form.get("researchConsent") === "on",
    discussionConsent: form.get("discussionConsent") === "on",
  };
}
