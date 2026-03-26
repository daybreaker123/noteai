import { TUTOR_DOCUMENT_MAX_BYTES } from "@/lib/tutor-chat-attachments";

/** `accept` attribute for hidden file input (PDF + .docx only). */
export const NOTE_IMPORT_FILE_ACCEPT =
  "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx";

/** Max extracted characters stored on a note (PostgreSQL text is large; cap for safety). */
export const NOTE_IMPORT_MAX_CHARS = 800_000;

export const NOTE_IMPORT_MAX_BYTES = TUTOR_DOCUMENT_MAX_BYTES;

/** Hidden file input accept for Analyze Slides (PDF + PowerPoint). */
export const SLIDES_ANALYZE_FILE_ACCEPT =
  "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx";

/** Derive note title from uploaded file name (strip extension, sanitize). */
export function noteTitleFromImportFileName(fileName: string): string {
  const base = fileName.replace(/\.(pdf|docx|pptx)$/i, "").trim();
  const cleaned = base
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 500) || "Imported note";
}
