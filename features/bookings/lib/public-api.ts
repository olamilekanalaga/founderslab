export async function api(path: string, payload?: unknown) {
  const r = await fetch(
    "/api/public/" + path,
    payload
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      : { cache: "no-store" },
  );
  const v = await r.json();
  if (!r.ok) throw new Error(v.error);
  return v;
}
