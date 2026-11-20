import { ZodError } from "zod";
import { DomainError } from "./domain";
export const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 250000) throw new DomainError("Request too large", 413);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new DomainError("Invalid JSON");
  }
}
export function failure(error: unknown) {
  if (error instanceof DomainError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .map((v) => `${v.path.join(".") || "Record"}: ${v.message}`)
          .join("; "),
      },
      400,
    );
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    error.code === "P2002"
  )
    return json(
      {
        error:
          "This record already exists. Use your saved reference or choose another entry.",
      },
      409,
    );
  return json(
    {
      error:
        "The request could not be completed. Check database setup or try again.",
    },
    500,
  );
}
