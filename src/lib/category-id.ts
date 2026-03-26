/** PostgreSQL `uuid` / Supabase `categories.id` format. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns a valid category UUID or `null` for uncategorized.
 * Invalid or sentinel strings would cause PostgREST insert failures (22P02 / FK).
 */
export function normalizeOptionalCategoryId(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t === "null" || t === "undefined" || t === "all") return null;
  if (!UUID_RE.test(t)) return null;
  return t;
}
