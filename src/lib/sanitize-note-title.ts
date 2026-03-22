/**
 * Strips leading/trailing markdown and formatting noise from AI-generated note titles.
 * Does not remove symbols in the middle of the string (math, chemistry, punctuation).
 */
export function sanitizeGeneratedNoteTitle(raw: string): string {
  let s = raw.trim();
  if (!s) return "Untitled";

  // Outer wrapping quotes (straight + common smart quotes / guillemets)
  s = s.replace(/^["'""''«»‹›]+/u, "").replace(/["'""''«»‹›]+$/u, "");
  s = s.trim();

  // Peels one “layer” at a time: headings, emphasis, code ticks, lists, blockquote, bullets
  const leading = new RegExp(
    "^(?:" +
      [
        "#{1,6}\\s*", // markdown headings
        "\\*{1,3}\\s*",
        "_{1,3}\\s*",
        "`{1,3}\\s*",
        "~{1,3}\\s*", // strikethrough
        ">\\s*", // blockquote
        "-\\s+", // list / hyphen bullet (requires space so "-5" is kept)
        "\\+\\s+",
        "\\d+\\.\\s+", // ordered list
        "[•·‣⁃]\\s*", // unicode bullets
      ].join("|") +
      ")",
    "u"
  );

  // Trailing emphasis/code/strike markers only (avoid touching meaningful punctuation)
  const trailing = /(?:\*{1,3}|_{1,3}|`{1,3}|~{1,3})+$/u;

  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.trim();
    s = s.replace(leading, "").replace(trailing, "");
  }

  s = s.trim();
  return s || "Untitled";
}
