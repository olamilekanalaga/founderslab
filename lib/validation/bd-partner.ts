import { z } from "zod";

const entry = z.string().trim().min(1).max(200);
export const bdRegistration = z.object({
  name: z
    .string()
    .trim()
    .regex(
      /^@?[A-Za-z0-9_]{1,15}$/,
      "Enter a valid X username, e.g. @ola__crrypt.",
    )
    .transform((handle) => `@${handle.replace(/^@/, "")}`),
  email: z.email().max(200),
  bank: entry,
  accountName: entry,
  accountNumber: z.string().regex(/^\d{10}$/),
});
