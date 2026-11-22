/** datetime-local controls carry a clock value, not the browser's timezone. */
export function utcInputValue(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value))
    return value.slice(0, 16);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}
export function utcInputToIso(value: string) {
  return new Date(`${utcInputValue(value)}:00Z`).toISOString();
}
