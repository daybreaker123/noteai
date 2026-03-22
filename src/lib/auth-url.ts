/**
 * Canonical app URL for NextAuth and redirects. Uses NEXTAUTH_URL only — set in Vercel
 * to your production origin (https://your-domain.com) with no trailing slash.
 */
export function getNextAuthUrl(): string | undefined {
  const raw = process.env.NEXTAUTH_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}
