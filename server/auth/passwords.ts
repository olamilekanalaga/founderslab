import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";

export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, encoded: string) {
  const [salt, key] = encoded.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex"),
    received = scryptSync(password, salt, 64);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
