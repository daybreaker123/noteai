import type { SupabaseClient } from "@supabase/supabase-js";

/** Max characters of note text injected into the tutor system prompt (leaves room for history + reply). */
export const TUTOR_NOTES_CONTEXT_MAX_CHARS = 180_000;

/** Appended to the tutor system prompt when “Use My Notes” is enabled. */
export const TUTOR_NOTES_CONTEXT_INSTRUCTION =
  "The user has provided their personal study notes as context. Reference them when relevant to answer questions.";

/**
 * Build a single markdown-ish digest of the user’s notes (most recently updated first).
 * Stops when the budget is exhausted.
 */
export async function buildTutorNotesContextDigest(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: rows, error } = await supabase
    .from("notes")
    .select("title, content, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !rows?.length) {
    return "";
  }

  let remaining = TUTOR_NOTES_CONTEXT_MAX_CHARS;
  const chunks: string[] = [];

  for (const n of rows) {
    if (remaining < 80) break;
    const title = (n.title || "Untitled").replace(/\s+/g, " ").trim().slice(0, 200);
    let body = String(n.content ?? "")
      .replace(/\r\n/g, "\n")
      .trim();
    if (!body) continue;

    const header = `\n\n### ${title}\n`;
    const maxBody = remaining - header.length - 24;
    if (maxBody < 80) break;

    if (body.length > maxBody) {
      body = `${body.slice(0, maxBody - 12).trimEnd()}\n\n[…truncated]`;
    }

    const block = header + body;
    chunks.push(block);
    remaining -= block.length;
  }

  return chunks.join("");
}
