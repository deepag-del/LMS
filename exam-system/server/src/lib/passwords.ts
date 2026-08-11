import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Password hashing with Node's built-in scrypt — no native/external dependency.
// Stored format: scrypt$N$salthex$keyhex

const SCRYPT_N = 16384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const [, nStr, saltHex, keyHex] = parts;
  const expected = Buffer.from(keyHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: Number(nStr),
  });
  return timingSafeEqual(actual, expected);
}

// Readable one-time passwords for provisioning: unambiguous alphabet, 12 chars.
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
export function generateTempPassword(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += TEMP_ALPHABET[b % TEMP_ALPHABET.length];
  return out;
}

export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must contain both letters and numbers";
  }
  return null;
}
