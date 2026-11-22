import { z } from "zod";
import { COUNTRIES } from "@/lib/catalog";
export const text = z.string().trim().max(5000);
export const short = z.string().trim().max(200);
export const required = short.min(1, "This field is required");
export const list = z.union([
  z.array(short),
  text.transform((v) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ),
]);
export const optionalList = list.optional().default([]);
export const id = short.optional();
export const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a valid https:// URL");
export const optionalUrl = z
  .union([safeUrl, z.literal("")])
  .optional()
  .default("");
export const date = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Enter a valid date and time");
export const country = z
  .string()
  .refine((v) => COUNTRIES.includes(v), "Choose a country from the list");
export const xHandle = short
  .transform((v) => v.replace(/^@/, "").toLowerCase())
  .pipe(
    z.string().regex(/^[a-z0-9_]{1,50}$/, "Use an X username without a URL"),
  );
