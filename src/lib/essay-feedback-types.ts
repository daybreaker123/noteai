/** Parsed essay feedback from the model (JSON shape). */

export type EssayFeedbackRating = "Strong" | "Good" | "Needs Work";

export type EssayFeedbackSection = {
  id: string;
  title: string;
  rating: EssayFeedbackRating;
  body: string;
  /** Pro-only section — show blurred placeholder for free users */
  locked?: boolean;
};

export type EssayFeedbackStructured = {
  gradeBadge: string;
  gradeBlurb: string;
  /** When true, grade area is blurred — Pro only */
  gradeLocked?: boolean;
  sections: EssayFeedbackSection[];
};

/** Section order in the feedback panel (matches model prompt). */
export const ESSAY_FEEDBACK_SECTION_ORDER = [
  "overall",
  "thesis",
  "structure",
  "evidence",
  "style",
  "grammar",
  "suggestions",
] as const;

const FREE_SECTION_IDS = new Set<string>(["overall", "grammar", "suggestions"]);

const LOCKED_SECTION_DEFAULTS: Record<string, { title: string }> = {
  thesis: { title: "Thesis & Argument" },
  structure: { title: "Structure & Organization" },
  evidence: { title: "Evidence & Support" },
  style: { title: "Writing Style" },
};

/** Strip Pro-only content for API responses to free users (server-side). */
export function toFreeTierStructured(full: EssayFeedbackStructured): EssayFeedbackStructured {
  const byId = Object.fromEntries(full.sections.map((s) => [s.id, s]));
  const sections: EssayFeedbackSection[] = [];

  for (const id of ESSAY_FEEDBACK_SECTION_ORDER) {
    if (FREE_SECTION_IDS.has(id)) {
      const existing = byId[id];
      if (existing) {
        sections.push({ ...existing, locked: false });
      }
    } else {
      const meta = LOCKED_SECTION_DEFAULTS[id] ?? { title: id };
      sections.push({
        id,
        title: meta.title,
        rating: "Good",
        body: "",
        locked: true,
      });
    }
  }

  return {
    gradeBadge: "",
    gradeBlurb: "",
    gradeLocked: true,
    sections,
  };
}

/** Safe markdown for clients when raw model JSON must be redacted. */
export function structuredToBasicMarkdown(s: EssayFeedbackStructured): string {
  return s.sections
    .filter((sec) => !sec.locked && sec.body.trim())
    .map((sec) => `## ${sec.title}\n**Rating:** ${sec.rating}\n\n${sec.body}`)
    .join("\n\n");
}

const RATING_SET = new Set<string>(["Strong", "Good", "Needs Work"]);

function normalizeRating(raw: string): EssayFeedbackRating {
  const t = raw.trim();
  if (RATING_SET.has(t)) return t as EssayFeedbackRating;
  const lower = t.toLowerCase();
  if (
    lower.includes("excellent") ||
    lower.includes("strong") ||
    lower.includes("very good") ||
    lower === "a" ||
    lower.startsWith("a-")
  ) {
    return "Strong";
  }
  if (
    lower.includes("need") ||
    lower.includes("weak") ||
    lower.includes("poor") ||
    lower.includes("significant")
  ) {
    return "Needs Work";
  }
  return "Good";
}

function stripCodeFence(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  return t;
}

/** Build plain text for annotation pass / fallback markdown (full Pro-shaped data). */
export function structuredToPlainText(s: EssayFeedbackStructured): string {
  const parts = s.sections
    .filter((sec) => !sec.locked && sec.body.trim())
    .map((sec) => `## ${sec.title}\n**Rating:** ${sec.rating}\n\n${sec.body}`);
  if (!s.gradeLocked && s.gradeBlurb.trim()) {
    parts.push(`## Grade Estimate\n${s.gradeBlurb}`);
  }
  return parts.join("\n\n");
}

export function parseEssayFeedbackJson(raw: string): EssayFeedbackStructured | null {
  let t = stripCodeFence(raw);
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const gradeBadge = typeof o.gradeBadge === "string" ? o.gradeBadge.trim() : "";
  const gradeBlurb = typeof o.gradeBlurb === "string" ? o.gradeBlurb.trim() : "";
  const arr = o.sections;
  if (!gradeBadge || !gradeBlurb || !Array.isArray(arr) || arr.length === 0) return null;

  const sections: EssayFeedbackSection[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const ratingRaw = typeof row.rating === "string" ? row.rating : "";
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!title || !body) continue;
    sections.push({
      id: id || title.toLowerCase().replace(/\s+/g, "-"),
      title,
      rating: normalizeRating(ratingRaw || "Good"),
      body,
    });
  }
  if (sections.length === 0) return null;
  return { gradeBadge, gradeBlurb, sections };
}
