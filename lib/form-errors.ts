import { ZodError } from "zod";
const labels: Record<string, string> = {
  founderName: "Founder name",
  companyName: "Company name",
  xHandle: "X username",
  website: "Website",
  country: "Country",
  description: "Product description",
  focus: "Business focus",
  privacyConsent: "Privacy consent",
  teamSize: "Team size",
  speakers: "Speakers",
  stage: "Product stage",
  sector: "Sector",
};
export function formError(
  error: unknown,
  fallback: string,
): { message: string; field?: string } {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    if (!issue) return { message: fallback };
    const field = String(issue.path[0] || "");
    const label = labels[field] || field.replace(/([a-z])([A-Z])/g, "$1 $2");
    return {
      message: label
        ? `${label[0].toUpperCase() + label.slice(1)}: ${issue.message}`
        : issue.message,
      field,
    };
  }
  return { message: error instanceof Error ? error.message : fallback };
}
