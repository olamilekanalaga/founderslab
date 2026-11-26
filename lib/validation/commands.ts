import { companyWebsite } from "./application";
import { z } from "zod";
import {
  TEAM_SIZES,
  BOOKING_STATUSES,
  CONFIDENCE,
  VERIFICATION,
  PIPELINE,
  PERMISSIONS,
} from "@/lib/catalog";
import {
  text,
  short,
  required,
  list,
  optionalList,
  id,
  safeUrl,
  optionalUrl,
  date,
  country,
  xHandle,
  optionalXHandle,
} from "./primitives";

const spaceLink = z
  .string()
  .trim()
  .max(2000)
  .transform((value) =>
    value && !/^[a-z][a-z0-9+.-]*:/i.test(value) ? `https://${value}` : value,
  )
  .pipe(z.union([safeUrl, z.literal("")]))
  .optional();

export const schemas = {
  "founder.save": z.object({
    id,
    name: required,
    role: required,
    xHandle,
    contact: short,
    country,
    relationshipStatus: z.enum([
      "New",
      "Contacted",
      "Interviewed",
      "Follow-up",
      "Partner",
      "Inactive",
    ]),
    source: required,
    verification: z.enum(VERIFICATION),
    notes: text,
    followUp: text,
    companyIds: optionalList,
  }),
  "company.save": z
    .object({
      id,
      name: required,
      description: text.min(1, "This field is required"),
      website: companyWebsite,
      xHandle: optionalXHandle,
      country,
      operatingCountries: optionalList,
      teamSize: z.enum(TEAM_SIZES),
      stage: required,
      sector: required,
      economicFunctions: optionalList,
      customers: optionalList,
      businessModels: optionalList,
      ecosystems: optionalList,
      chains: optionalList,
      integrations: optionalList,
      distribution: optionalList,
      hiringStatus: z.enum(["Unknown", "Hiring", "Not hiring"]),
      hiringEvidence: text,
      challenges: text,
      founderIds: optionalList,
      labelIds: optionalList,
    })
    .refine(
      (v) => v.hiringStatus !== "Hiring" || v.hiringEvidence.trim().length > 0,
      "An explicit hiring claim requires evidence",
    ),
  "application.review": z.object({
    id: required,
    status: z.enum(["Approved", "Waitlisted", "Declined"]),
    sessionId: required.optional(),
  }),
  "space-data.save": z.object({
    submit: z.boolean().optional().default(false),
    founderBookingIds: z.array(required).max(500).optional(),
    postUrl: spaceLink,
    liveUrl: spaceLink,
    recordingUrl: spaceLink,
    sessionId: required,
    liveListeners: z.number().int().min(0).max(100000000).nullable(),
    durationMinutes: z.number().int().min(0).max(1000000).nullable(),
    notes: text.optional().default(""),
    teams: z
      .array(
        z.object({
          companyId: required,
          foundersCount: z.coerce.number().int().min(0).max(100000),
          otherTeamCount: z.coerce.number().int().min(0).max(100000),
        }),
      )
      .max(500),
  }),
  "session.save": z
    .object({
      id,
      title: required,
      startsAt: date,
      timezone: required,
      host: required,
      capacity: z.coerce.number().int().min(1).max(50),
      deadline: date,
      status: z.enum(["Scheduled", "Completed", "Cancelled"]),
      researchStatus: z.enum(["Not started", "In progress", "Complete"]),
      liveUrl: optionalUrl,
      recordingUrl: optionalUrl,
      postUrl: optionalUrl,
      notes: text,
    })
    .refine(
      (v) => Date.parse(v.deadline) <= Date.parse(v.startsAt),
      "Deadline must precede the session",
    )
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v.timezone });
        return true;
      } catch {
        return false;
      }
    }, "Use a valid IANA timezone"),
  "booking.create": z.object({
    applicationId: required,
    sessionId: required,
    speakers: z.coerce.number().int().min(1).max(10),
  }),
  "booking.review": z.object({
    id: required,
    status: z.enum(BOOKING_STATUSES),
  }),
  "research.save": z.object({
    id,
    founderId: required,
    companyId: required,
    sessionId: required,
    recordedAt: date,
    evidence: text.min(1, "This field is required"),
    confidence: z.enum(CONFIDENCE),
    verification: z.enum(VERIFICATION),
    visibility: z.enum(["Private", "Public"]),
    status: z.enum(["Draft", "Complete"]),
    answers: z.record(z.string(), text),
    classifications: z.record(z.string(), short).optional().default({}),
  }),
  "need.save": z.object({
    id,
    companyId: required,
    kind: required,
    description: text.min(1, "This field is required"),
    evidence: text.min(1, "This field is required"),
    confidence: z.enum(CONFIDENCE),
    verification: z.enum(VERIFICATION),
  }),
  "relationship.save": z
    .object({
      id,
      companyAId: required,
      companyBId: required,
      type: required,
      reason: text.min(1, "This field is required"),
      evidence: text.min(1, "This field is required"),
      confidence: z.enum(CONFIDENCE),
      verification: z.enum(VERIFICATION),
      reviewedAt: date,
    })
    .refine(
      (v) => v.companyAId !== v.companyBId,
      "Select two different companies",
    ),
  "opportunity.save": z.object({
    id,
    companyId: required,
    founderId: required,
    needId: required,
    category: required,
    solution: text.min(1, "This field is required"),
    skills: optionalList,
    decisionMaker: required,
    budget: short.default("Unknown"),
    evidence: text.min(1, "This field is required"),
    owner: required,
    nextAction: text.min(1, "This field is required"),
    followUpDate: date,
    status: z.enum(PIPELINE),
    outcome: text,
  }),
  "campaign.save": z.object({
    id,
    name: required,
    period: z.string().regex(/^\d{4}-\d{2}$/),
    target: z.coerce.number().int().min(1).max(500),
    awardAmount: required,
    rules: text.min(1, "This field is required"),
    criteria: text.min(1, "This field is required"),
    status: z.enum(["Open", "Reviewing", "Closed"]),
  }),
  "campaign.assess": z.object({
    campaignId: required,
    founderId: required,
    eligible: z.boolean(),
    assessment: text.min(1, "This field is required"),
  }),
  "award.save": z
    .object({
      campaignId: required,
      founderId: required,
      rationale: text.min(1, "This field is required"),
      decisionDate: date,
      status: z.enum([
        "Selected",
        "Transfer pending",
        "Transferred",
        "Cancelled",
      ]),
      transactionReference: short,
    })
    .refine(
      (v) =>
        v.status !== "Transferred" || v.transactionReference.trim().length > 0,
      "Record the actual transaction reference before marking transferred",
    ),
  "taxonomy.save": z.object({
    id,
    group: z.enum([
      "Sector",
      "Economic function",
      "Customer segment",
      "Business model",
      "Product stage",
      "Geographic market",
      "Blockchain ecosystem",
      "Business needs",
      "Company relationship",
      "Opportunity type",
    ]),
    name: required,
    active: z.boolean().default(true),
  }),
  "settings.save": z.object({
    countryOptions: list.pipe(z.array(country).min(1)),
    capacity: z.coerce.number().int().min(1).max(50),
    retentionDays: z.coerce.number().int().min(30).max(3650),
    campaignTarget: z.coerce.number().int().min(1).max(500),
    awardAmount: required,
    terms: text.min(1, "This field is required"),
  }),
  "invite.create": z.object({
    email: z.email().transform((v) => v.toLowerCase()),
    name: required,
    roleId: z.literal("admin").default("admin"),
  }),
  "user.permissions": z.object({
    id: required,
    active: z.boolean(),
    permissions: z.array(z.enum(PERMISSIONS)),
  }),
};
export function parseCommand(type: string, payload: unknown) {
  const schema = schemas[type as keyof typeof schemas];
  if (!schema) throw new Error("Unknown action");
  return schema.parse(payload);
}
