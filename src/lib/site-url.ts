/**
 * Public site origin for links in emails and redirects.
 * Prefer NEXTAUTH_URL, then NEXT_PUBLIC_APP_URL, then Vercel preview URL, then localhost.
 */
export function getSiteUrl(): string {
  const a = process.env.NEXTAUTH_URL?.trim();
  if (a) return a.replace(/\/$/, "");
  const b = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (b) return b.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}
