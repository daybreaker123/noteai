import { supabaseAdmin } from "@/lib/supabase-admin";
import { ensureEditorHtml, htmlToPlainText } from "@/lib/note-content-html";
import type { StudySetKind } from "@/lib/api-types";
import type { QuizQuestionPublic } from "@/lib/shared-public-types";

export type SharedContentRow = {
  id: string;
  user_id: string;
  content_type: "note" | "study_set";
  content_id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchShareRowByToken(token: string): Promise<SharedContentRow | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("shared_content")
    .select("id, user_id, content_type, content_id, is_public, created_at, updated_at")
    .eq("id", token)
    .maybeSingle();
  if (error || !data) return null;
  return data as SharedContentRow;
}

export type PublicNotePageResult =
  | { view: "not_found" }
  | { view: "redirect_study"; token: string }
  | { view: "private" }
  | { view: "ok"; title: string; bodyPlain: string };

export async function resolvePublicNotePage(
  token: string,
  viewerUserId: string | undefined
): Promise<PublicNotePageResult> {
  const row = await fetchShareRowByToken(token);
  if (!row) return { view: "not_found" };
  if (row.content_type !== "note") return { view: "redirect_study", token: row.id };
  const canView = row.is_public || row.user_id === viewerUserId;
  if (!canView) return { view: "private" };
  if (!supabaseAdmin) return { view: "not_found" };
  const { data: note } = await supabaseAdmin
    .from("notes")
    .select("title, content")
    .eq("id", row.content_id)
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (!note) return { view: "not_found" };
  const bodyPlain = htmlToPlainText(ensureEditorHtml(note.content ?? ""));
  return { view: "ok", title: (note.title ?? "Untitled").trim() || "Untitled", bodyPlain };
}

export type PublicStudyPageResult =
  | { view: "not_found" }
  | { view: "redirect_note"; token: string }
  | { view: "private" }
  | {
      view: "ok";
      title: string;
      kind: StudySetKind;
      cards: { front: string; back: string }[];
      questions: QuizQuestionPublic[];
    };

export async function resolvePublicStudyPage(
  token: string,
  viewerUserId: string | undefined
): Promise<PublicStudyPageResult> {
  const row = await fetchShareRowByToken(token);
  if (!row) return { view: "not_found" };
  if (row.content_type !== "study_set") return { view: "redirect_note", token: row.id };
  const canView = row.is_public || row.user_id === viewerUserId;
  if (!canView) return { view: "private" };
  if (!supabaseAdmin) return { view: "not_found" };
  const { data: set } = await supabaseAdmin
    .from("study_sets")
    .select("title, kind, payload")
    .eq("id", row.content_id)
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (!set) return { view: "not_found" };
  const kind = set.kind as StudySetKind;
  const payload = (set.payload ?? {}) as Record<string, unknown>;
  const cardsRaw = payload.cards;
  const questionsRaw = payload.questions;
  const cards = Array.isArray(cardsRaw)
    ? (cardsRaw as { front?: string; back?: string }[])
        .filter((c) => c.front && c.back)
        .map((c) => ({ front: c.front!, back: c.back! }))
    : [];
  const questions = Array.isArray(questionsRaw)
    ? (questionsRaw as {
        question?: string;
        options?: string[];
        correctIndex?: number;
        explanation?: string;
      }[])
        .filter((q) => q.question && Array.isArray(q.options) && q.options.length > 0 && typeof q.correctIndex === "number")
        .map((q) => ({
          question: q.question!,
          options: q.options!,
          correctIndex: Math.min(Math.max(0, q.correctIndex!), q.options!.length - 1),
          explanation: q.explanation,
        }))
    : [];
  return {
    view: "ok",
    title: (set.title ?? "Study set").trim() || "Study set",
    kind,
    cards,
    questions,
  };
}
