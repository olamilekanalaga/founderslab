import { z } from "zod";

const entry = z.string().trim().min(1).max(200);
export const bdRegistration = z.object({
  name: entry,
  email: z.email().max(200),
  bank: entry,
  accountName: entry,
  accountNumber: z.string().regex(/^\d{10}$/),
});
