/**
 * Note `content` is stored as HTML from Tiptap. Legacy rows may be plain text.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Detect stored rich HTML (Tiptap output or pasted HTML). */
export function isLikelyRichHtml(content: string): boolean {
  const s = content.trim();
  if (!s.startsWith("<")) return false;
  if (/^<(p|div|h[1-6]|ul|ol|blockquote|pre|table|figure|hr|img|mark)\b/i.test(s)) return true;
  return /<\/(p|div|ul|ol|h[1-6]|table|blockquote|li)>/i.test(s);
}

/** Wrap legacy plain text as paragraphs for Tiptap. */
export function migratePlainTextToHtml(content: string): string {
  if (!content.trim()) return "<p></p>";
  if (isLikelyRichHtml(content)) return content;
  const parts = content.split(/\n{2,}/).map((p) => p.trim());
  const blocks = parts.length > 0 ? parts : [content.trim()];
  return blocks
    .map((block) => {
      const withBreaks = escapeHtml(block).replace(/\n/g, "<br>");
      return `<p>${withBreaks}</p>`;
    })
    .join("");
}

/** Normalize any stored note body to HTML safe for the editor. */
export function ensureEditorHtml(content: string): string {
  if (!content.trim()) return "<p></p>";
  if (isLikelyRichHtml(content)) return content;
  return migratePlainTextToHtml(content);
}

/** Strip optional ``` / ```html wrapper from model output. */
export function stripAiHtmlCodeFence(text: string): string {
  let s = text.trim();
  if (!s.startsWith("```")) return s;
  s = s.replace(/^```[a-zA-Z]*\s*\n?/, "");
  if (s.endsWith("```")) s = s.slice(0, -3).trimEnd();
  return s.trim();
}

/** If the model wrapped output in a full document, keep only the body inner HTML. */
export function extractHtmlBodyFragment(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1].trim() : html.trim();
}

/**
 * Turn Improve API response into editor-ready HTML: fences, optional body wrapper, then ensure valid fragment.
 */
export function normalizeImprovedNoteHtml(raw: string): string {
  let s = stripAiHtmlCodeFence(raw);
  s = extractHtmlBodyFragment(s);
  return ensureEditorHtml(s);
}

/**
 * Strip HTML to plain text for AI APIs, search, previews, PDF text export.
 * Works without DOM (SSR-safe).
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  const trimmed = html.trim();
  if (!trimmed.startsWith("<")) return html;

  let t = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*h[1-6]\s*>/gi, "\n\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<\/\s*tr\s*>/gi, "\n")
    .replace(/<\/\s*div\s*>/gi, "\n");

  t = t
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");

  return t.trim();
}

/** One-line preview for note cards. */
export function noteContentPreview(content: string, maxLen = 120): string {
  const plain = htmlToPlainText(content);
  if (plain.length <= maxLen) return plain || "No content";
  return `${plain.slice(0, maxLen)}…`;
}
