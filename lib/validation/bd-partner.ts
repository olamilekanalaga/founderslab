import { z } from "zod";

const entry = z.string().trim().min(1).max(200);
const bdXHandle = z
  .string()
  .trim()
  .regex(
    /^@?[A-Za-z0-9_]{1,15}$/,
    "Enter a valid X username, e.g. @ola__crrypt.",
  )
  .transform((handle) => handle.replace(/^@/, "").toLowerCase());

export const optionalBdXHandle = z
  .preprocess(
    (value) => (typeof value === "string" && !value.trim() ? null : value),
    bdXHandle.nullish(),
  )
  .transform((value) => value ?? null);

export const bdRegistration = z.object({
  name: bdXHandle.transform((handle) => `@${handle}`),
  email: z.email().max(200),
  bank: entry,
  accountName: entry,
  accountNumber: z.string().regex(/^\d{10}$/),
});
