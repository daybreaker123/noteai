import type { Note, StudySetSummary } from "@/lib/api-types";
import { htmlToPlainText } from "@/lib/note-content-html";

export const STUDY_PROGRESS_STEP_IDS = ["write", "improve", "summarize", "study"] as const;
export type StudyProgressStepId = (typeof STUDY_PROGRESS_STEP_IDS)[number];

export const STUDY_PROGRESS_LABELS: Record<StudyProgressStepId, string> = {
  write: "Write",
  improve: "Improve",
  summarize: "Summarize",
  study: "Study",
};

/** True if a saved flashcard or quiz set references this note. */
export function noteHasSavedStudySet(noteId: string, sets: StudySetSummary[]): boolean {
  for (const s of sets) {
    if (s.note_id && String(s.note_id) === noteId) return true;
    const ids = s.note_ids;
    if (Array.isArray(ids) && ids.some((x) => String(x) === noteId)) return true;
  }
  return false;
}

export type StudyProgressCompletion = Record<StudyProgressStepId, boolean>;

export function computeStudyProgressCompletion(
  note: Pick<Note, "content" | "improved_at" | "summarized_at"> | null | undefined,
  options: { hasSummaryInSession: boolean; hasSavedStudySet: boolean }
): StudyProgressCompletion {
  const plain = htmlToPlainText(note?.content ?? "").trim();
  const hasWrite = plain.length > 0;
  return {
    write: hasWrite,
    improve: !!(note?.improved_at),
    summarize: !!(note?.summarized_at) || options.hasSummaryInSession,
    study: options.hasSavedStudySet,
  };
}

export function studyProgressCompletedCount(c: StudyProgressCompletion): number {
  return STUDY_PROGRESS_STEP_IDS.filter((k) => c[k]).length;
}
