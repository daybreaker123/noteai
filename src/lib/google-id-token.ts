/**
 * Decode Google OIDC id_token payload (JWT) without signature verification.
 * Used only after Google has issued the token via our OAuth code exchange.
 */
export function decodeGoogleIdTokenPayload(
  idToken: string | null | undefined
): { sub?: string; email?: string; name?: string; picture?: string } | null {
  if (!idToken || typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const segment = parts[1];
    const json = Buffer.from(segment, "base64url").toString("utf8");
    return JSON.parse(json) as { sub?: string; email?: string; name?: string; picture?: string };
  } catch {
    return null;
  }
}
