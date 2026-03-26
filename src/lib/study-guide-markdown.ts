/**
 * Convert study-guide model output (Markdown-style) to a small HTML fragment for the note editor.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip common ```markdown fences. */
function stripFences(raw: string): string {
  let s = raw.trim();
  if (!s.startsWith("```")) return s;
  s = s.replace(/^```[a-zA-Z]*\s*\n?/, "");
  if (s.endsWith("```")) s = s.slice(0, -3).trimEnd();
  return s.trim();
}

/**
 * Handles # / ## / ### headings, - or * bullets, numbered lists, blank lines → paragraphs.
 */
export function studyGuideMarkdownToHtml(markdown: string): string {
  const text = stripFences(markdown);
  if (!text) return "<p></p>";

  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let ulOpen = false;
  let olOpen = false;

  const closeLists = () => {
    if (ulOpen) {
      blocks.push("</ul>");
      ulOpen = false;
    }
    if (olOpen) {
      blocks.push("</ol>");
      olOpen = false;
    }
  };

  const flushParagraph = (buf: string[]) => {
    const t = buf.join("\n").trim();
    if (!t) return;
    const withBreaks = escapeHtml(t).replace(/\n/g, "<br>");
    blocks.push(`<p>${withBreaks}</p>`);
    buf.length = 0;
  };

  let paraBuf: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine;
    const h3 = line.match(/^###\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h1 = line.match(/^#\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);

    if (h1 || h2 || h3) {
      flushParagraph(paraBuf);
      closeLists();
      const content = escapeHtml((h1 || h2 || h3)![1]!.trim());
      if (h1) blocks.push(`<h2>${content}</h2>`);
      else if (h2) blocks.push(`<h2>${content}</h2>`);
      else blocks.push(`<h3>${content}</h3>`);
      continue;
    }

    if (bullet) {
      flushParagraph(paraBuf);
      if (olOpen) {
        blocks.push("</ol>");
        olOpen = false;
      }
      if (!ulOpen) {
        blocks.push("<ul>");
        ulOpen = true;
      }
      blocks.push(`<li>${escapeHtml(bullet[1]!.trim())}</li>`);
      continue;
    }

    if (numbered) {
      flushParagraph(paraBuf);
      if (ulOpen) {
        blocks.push("</ul>");
        ulOpen = false;
      }
      if (!olOpen) {
        blocks.push("<ol>");
        olOpen = true;
      }
      blocks.push(`<li>${escapeHtml(numbered[1]!.trim())}</li>`);
      continue;
    }

    if (!line.trim()) {
      flushParagraph(paraBuf);
      closeLists();
      continue;
    }

    paraBuf.push(line);
  }

  flushParagraph(paraBuf);
  closeLists();

  return blocks.length > 0 ? blocks.join("\n") : `<p>${escapeHtml(text)}</p>`;
}
