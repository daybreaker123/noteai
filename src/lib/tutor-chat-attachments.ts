/** Client + server shared limits for tutor file attachments (non-image). */
export const TUTOR_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const TUTOR_EXTRACTED_TEXT_MAX_CHARS = 120_000;

/** Hidden file input `accept` — images, PDF, Word; no video. */
export const TUTOR_FILE_INPUT_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp,application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

export function isAllowedImageFile(file: File): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type);
}

export function isPdfFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return file.type === PDF_MIME || n.endsWith(".pdf");
}

export function isDocxFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return file.type === DOCX_MIME || n.endsWith(".docx");
}

export function isExtractableDocument(file: File): boolean {
  return isPdfFile(file) || isDocxFile(file);
}

/** Classify a user-selected file for the tutor composer. */
export function classifyTutorFile(file: File): "image" | "document" | "unsupported" {
  if (isVideoFile(file)) return "unsupported";
  if (isAllowedImageFile(file)) return "image";
  if (isExtractableDocument(file)) return "document";
  return "unsupported";
}

export function documentDisplayType(file: File): "PDF" | "Word" {
  return isPdfFile(file) ? "PDF" : "Word";
}
