/** Stable keys for chain counts; count a project once per named chain. */
export function chainNames(values: string | string[]): string[] {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .flatMap((value) => value.split(","))
        .map((value) => value.trim().replace(/\s+/g, " ").toLowerCase())
        .filter(Boolean),
    ),
  );
}
