export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function check(value: unknown, message: string): asserts value {
  if (!value) throw new DomainError(message);
}
