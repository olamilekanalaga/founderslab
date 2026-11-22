import { z } from "zod";
import { TEAM_SIZES } from "@/lib/catalog";
import {
  text,
  short,
  required,
  optionalList,
  country,
  xHandle,
  optionalXHandle,
} from "./primitives";

/** Accept bare company domains; persist a complete HTTP(S) URL for safe links. */
export const companyWebsite = z
  .string()
  .trim()
  .min(1, "Enter a company website")
  .max(2000)
  .transform((value) =>
    /^https?:\/\//i.test(value) ? value : `https://${value}`,
  )
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        url.hostname.includes(".") &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Enter a valid website, for example example.com");

export const applicationSchema = z.object({
  founderName: required,
  companyName: required,
  xHandle,
  projectXHandle: optionalXHandle,
  website: companyWebsite,
  country,
  description: text.min(1, "Add a product description"),
  speakers: z.coerce.number().int().min(1).max(10),
  teamSize: z.enum(TEAM_SIZES),
  stage: required,
  sector: required,
  focus: text.min(1, "Add your main business focus"),
  founderRole: required.optional().default("Founder"),
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

/** Current public form requires all programme answers except the private email.
 * The legacy schema above remains usable for historical application snapshots.
 */
export const publicApplicationSchema = applicationSchema.extend({
  projectXHandle: xHandle,
  founderRole: required,
  teamCountries: optionalList.refine(
    (values) => values.length > 0,
    "Enter your team countries",
  ),
  ecosystem: required,
  hiring: z.boolean(),
  seeking: text.min(1, "Enter an answer, or None if not applicable"),
  comments: text.min(1, "Enter an answer, or None if not applicable"),
  contact: z
    .string()
    .trim()
    .pipe(z.union([z.email(), z.literal("")]))
    .optional()
    .default(""),
});
