import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

/**
 * Formato del hash: "scrypt$<salt-base64>$<derived-base64>".
 * scrypt es una KDF resistente a hardware, incluida en Node — no requiere deps.
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(SALT_LEN);
  const derived = scryptSync(pin, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [algo, saltB64, derivedB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !derivedB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(derivedB64, "base64");
  const actual = scryptSync(pin, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{6}$/.test(pin);
}
