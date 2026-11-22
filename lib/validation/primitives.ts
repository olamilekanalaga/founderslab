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
const countryKey = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();
export const country = z
  .string()
  .transform(
    (value) =>
      COUNTRIES.find((name) => countryKey(name) === countryKey(value)) ||
      value.trim(),
  )
  .refine((v) => COUNTRIES.includes(v), "Choose a country from the list");
export const xHandle = short
  .transform((v) => v.replace(/\s+/g, "").replace(/^@/, "").toLowerCase())
  .pipe(
    z.string().regex(/^[a-z0-9_]{1,50}$/, "Use an X username without a URL"),
  );

/** Optional official project identity; blank and absent values remain unknown. */
export const optionalXHandle = z
  .preprocess(
    (value) => (typeof value === "string" && !value.trim() ? null : value),
    xHandle.nullish(),
  )
  .transform((value) => value ?? null);
