import { anthropicComplete, ANTHROPIC_MODEL_HAIKU } from "@/lib/anthropic";
import { parseAttachmentsFromDb, parseDocumentContextAttachments } from "@/lib/tutor-anthropic-content";

/** Haiku model for tutor sidebar titles (low cost). */
export const TUTOR_TITLE_MODEL = ANTHROPIC_MODEL_HAIKU;

const TITLE_SYSTEM = `Based on this conversation exchange, generate a concise 4-6 word title that describes what this tutoring session is about. If an image was involved, try to infer what subject it relates to from the AI response. Return only the title, no quotes.`;

/**
 * Build human-readable notes about attachments on the first turn so the title model can interpret
 * image-only or file-only opens.
 */
export function buildFirstTurnTitleContext(
  content: string,
  rawAttachments: unknown
): { visibleUserText: string; attachmentContext: string | null } {
  const visibleUserText = content.trim();
  const imgs = parseAttachmentsFromDb(rawAttachments);
  const docs = parseDocumentContextAttachments(rawAttachments);
  const hasImg = Boolean(imgs?.length);
  const hasDoc = docs.length > 0;

  if (!hasImg && !hasDoc) {
    return { visibleUserText, attachmentContext: null };
  }

  if (!visibleUserText) {
    if (hasDoc && docs[0]) {
      const dt = (docs[0].display_type ?? "document").trim();
      return {
        visibleUserText: "",
        attachmentContext: `The user sent only a ${dt} attachment ("${docs[0].file_name}") with no typed message.`,
      };
    }
    if (hasImg) {
      return {
        visibleUserText: "",
        attachmentContext: "The user sent only an image attachment with no typed message.",
      };
    }
  }

  const bits: string[] = [];
  if (hasImg) bits.push("an image");
  if (hasDoc && docs[0]) {
    bits.push(`a ${(docs[0].display_type ?? "document").trim()} file (${docs[0].file_name})`);
  }
  return {
    visibleUserText,
    attachmentContext: `The user also attached ${bits.join(" and ")} in their first message.`,
  };
}

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
 * After the first user + assistant exchange, call Haiku with both turns so titles reflect the topic
 * (including inferring subject from the tutor reply when the user only sent an image).
 */
export async function generateTutorConversationTitleFromExchange(params: {
  firstUserContent: string;
  firstUserAttachments: unknown;
  firstAssistantResponse: string;
  userId: string;
}): Promise<string | null> {
  const assistant = params.firstAssistantResponse.trim();
  if (!assistant) {
    return null;
  }

  const { visibleUserText, attachmentContext } = buildFirstTurnTitleContext(
    params.firstUserContent,
    params.firstUserAttachments
  );

  const blocks: string[] = [];
  if (visibleUserText) {
    blocks.push(`First user message:\n${visibleUserText.slice(0, 4000)}`);
  }
  if (attachmentContext) {
    blocks.push(attachmentContext);
  }
  if (!visibleUserText && !attachmentContext) {
    blocks.push("First user message:\n(Empty — no visible text in the first turn.)");
  }
  blocks.push(`First tutor (AI) response:\n${assistant.slice(0, 8000)}`);

  const userMessage = blocks.join("\n\n");

  try {
    const raw = await anthropicComplete(TITLE_SYSTEM, userMessage, {
      maxTokens: 48,
      model: TUTOR_TITLE_MODEL,
      usage: { userId: params.userId, variant: "complete" },
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
