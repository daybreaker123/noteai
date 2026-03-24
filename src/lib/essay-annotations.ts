import type { EssayAnnotationIssueType, EssayAnnotationRaw } from "./essay-annotation-types";

export type ResolvedAnnotationSpan = {
  start: number;
  end: number;
  type: EssayAnnotationIssueType;
  suggestion: string;
};

const TYPE_ALIASES: Record<string, EssayAnnotationIssueType> = {
  grammar: "grammar",
  spelling: "spelling",
  clarity: "clarity",
  structure: "structure",
  word_choice: "word_choice",
  wordchoice: "word_choice",
  "word choice": "word_choice",
  diction: "word_choice",
};

export function normalizeIssueType(raw: string): EssayAnnotationIssueType | null {
  const k = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const compact = k.replace(/[\s_-]+/g, "_");
  return TYPE_ALIASES[k] ?? TYPE_ALIASES[compact] ?? null;
}

export function parseAnnotationsJson(raw: string): EssayAnnotationRaw[] {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const ann = (parsed as { annotations?: unknown }).annotations;
  if (!Array.isArray(ann)) return [];
  const out: EssayAnnotationRaw[] = [];
  for (const item of ann) {
    if (!item || typeof item !== "object") continue;
    const o = item as { text?: unknown; type?: unknown; suggestion?: unknown };
    const text = typeof o.text === "string" ? o.text : "";
    const typeStr = typeof o.type === "string" ? o.type : "";
    const suggestion = typeof o.suggestion === "string" ? o.suggestion : "";
    const type = normalizeIssueType(typeStr);
    const textTrim = text.trim();
    if (!textTrim || !type || !suggestion.trim()) continue;
    out.push({ text: textTrim, type, suggestion: suggestion.trim() });
  }
  return out;
}

/**
 * Map model annotations to non-overlapping character ranges in the essay.
 * Uses sequential search to handle repeated phrases reasonably.
 */
export function resolveAnnotationSpans(
  essay: string,
  raw: EssayAnnotationRaw[]
): ResolvedAnnotationSpan[] {
  const ranges: ResolvedAnnotationSpan[] = [];
  let searchFrom = 0;
  for (const a of raw) {
    const t = a.text.trim();
    if (!t) continue;
    let i = essay.indexOf(t, searchFrom);
    if (i === -1) i = essay.indexOf(t, 0);
    if (i === -1) continue;
    ranges.push({
      start: i,
      end: i + t.length,
      type: a.type,
      suggestion: a.suggestion,
    });
    searchFrom = i + t.length;
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: ResolvedAnnotationSpan[] = [];
  let lastEnd = -1;
  for (const r of ranges) {
    if (r.start < lastEnd) continue;
    merged.push(r);
    lastEnd = r.end;
  }
  return merged;
}
