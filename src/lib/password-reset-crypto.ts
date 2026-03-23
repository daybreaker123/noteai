import { createHash, randomBytes } from "crypto";

/** URL-safe raw token for the reset link; store only SHA-256 hash in the database. */
export function createPasswordResetToken(): { raw: string; tokenHash: string } {
  const raw = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  return { raw, tokenHash };
}

export function hashPasswordResetToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}
