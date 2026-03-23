import { anthropicComplete, ANTHROPIC_MODEL_HAIKU } from "@/lib/anthropic";

const TITLE_SYSTEM = `You reply with only a short plain-text title. No quotation marks, no explanation.`;

/**
 * Sanitize model output for `tutor_conversations.title` (short, single line).
 */
export function sanitizeConversationTitle(raw: string): string {
  let s = raw
    .trim()
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/\s+/g, " ");
  s = s.replace(/[.!?;:]+$/g, "").trim();
  if (s.length > 120) {
    s = `${s.slice(0, 117)}…`;
  }
  return s || "New chat";
}

/**
 * Quick Haiku call after the first tutor exchange to set a real sidebar title (not the raw first message).
 */
export async function generateTutorConversationTitle(
  firstUserMessage: string,
  userId: string
): Promise<string | null> {
  const q = firstUserMessage.trim().slice(0, 2000);
  if (!q) {
    return null;
  }
  const user = `Generate a concise 4-6 word title for a tutoring conversation that starts with this question: ${q}

Return only the title, no quotes or punctuation.`;
  try {
    const raw = await anthropicComplete(TITLE_SYSTEM, user, {
      maxTokens: 48,
      model: ANTHROPIC_MODEL_HAIKU,
      usage: { userId, variant: "complete" },
    });
    const title = sanitizeConversationTitle(raw);
    if (!title || title.length < 3) {
      return null;
    }
    return title;
  } catch (e) {
    console.error("[tutor] conversation title generation failed:", e);
    return null;
  }
}
