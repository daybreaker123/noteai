import type { StudySetKind } from "@/lib/api-types";

/** Human-readable title for a study set from note titles (single or multi). */
export function buildStudySetTitleFromNoteTitles(titles: (string | null | undefined)[]): string {
  const n = titles.length;
  const cleaned = titles.map((x) => (x ?? "Untitled").trim() || "Untitled").slice(0, 3);
  if (n === 0) return "Study set";
  if (n === 1) return cleaned[0];
  if (n === 2) return `${cleaned[0]} & ${cleaned[1]}`;
  return `${cleaned[0]}, ${cleaned[1]} +${n - 2} more`;
}

export function studySetItemCount(kind: StudySetKind, payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const p = payload as { cards?: unknown[]; questions?: unknown[] };
  if (kind === "flashcards") return Array.isArray(p.cards) ? p.cards.length : 0;
  return Array.isArray(p.questions) ? p.questions.length : 0;
}

/** Latest cached set for single-note study: only sets generated from this note alone. */
export function rowMatchesSingleNoteCache(
  noteId: string,
  row: { note_id?: string | null; note_ids?: unknown }
): boolean {
  if (row.note_id && String(row.note_id) === noteId) return true;
  const ids = row.note_ids;
  if (Array.isArray(ids) && ids.length === 1 && String(ids[0]) === noteId) return true;
  return false;
}
