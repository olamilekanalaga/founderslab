export async function commercialRequest<T>(
  query = "",
  mutation?: { csrf?: string; data: object },
): Promise<T> {
  const response = await fetch(
    "/api/commercial" + query,
    mutation
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": mutation.csrf || "",
          },
          body: JSON.stringify(mutation.data),
        }
      : { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "The request could not be completed.");
  return result;
}
