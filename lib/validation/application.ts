import { z } from "zod";
import { TEAM_SIZES } from "@/lib/catalog";
import {
  text,
  short,
  required,
  optionalList,
  safeUrl,
  country,
  xHandle,
} from "./primitives";

export const applicationSchema = z.object({
  founderName: required,
  companyName: required,
  xHandle,
  website: safeUrl,
  country,
  description: text.min(1, "Add a product description"),
  speakers: z.coerce.number().int().min(1).max(10),
  teamSize: z.enum(TEAM_SIZES),
  stage: required,
  sector: required,
  focus: text.min(1, "Add your main business focus"),
  founderRole: short.optional().default("Founder"),
  contact: short.optional().default(""),
  teamCountries: optionalList,
  ecosystem: short.optional().default(""),
  hiring: z.boolean().optional().default(false),
  seeking: text.optional().default(""),
  comments: text.optional().default(""),
  privacyConsent: z.literal(true, {
    error: "Accept the privacy notice to submit",
  }),
  promotionalConsent: z.boolean().optional().default(false),
  websiteTrap: z
    .string()
    .optional()
    .refine((v) => !v, "Submission rejected"),
});
export const normaliseKey = (handle: string, company: string) =>
  `${handle.replace(/^@/, "").trim().toLowerCase()}:${company.trim().toLowerCase().replace(/\s+/g, " ")}`;
