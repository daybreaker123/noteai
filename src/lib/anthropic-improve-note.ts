import { anthropicComplete, ANTHROPIC_MODEL_SONNET } from "@/lib/anthropic";

export const IMPROVE_NOTE_SYSTEM_PROMPT = `You are an expert note-taker and tutor. The user message is note content: it may be HTML (from a rich editor) or plain text for older notes.

Improve the notes by:
1) Fixing unclear or incomplete explanations and filling gaps in understanding
2) Adding relevant context, examples, or detail that helps a student studying this topic
3) Correcting anything that seems factually uncertain (if the user marked something with ??, address it)
4) Keeping a natural student voice while making the writing clearer and more complete

Preserve all existing formatting including tables, bullet points, headings, code blocks, and other structured elements. If a table exists in the notes, keep it intact and only improve the text content within it. Return the improved content in the same format as the input.

Formatting rules (critical):
- Preserve all structure from the input: tables (same rows/columns/header cells), bullet/numbered/task lists, headings, blockquotes, code blocks, horizontal rules, images (keep the same src URLs), links, and inline formatting (bold, italic, underline, strike, highlight) and text alignment when expressed as HTML. Only change the wording inside cells, headings, paragraphs, and list items — do not remove or flatten tables or lists.
- If the input is HTML, return improved content as HTML only (a fragment for a rich text editor body). Reuse the same tags and attributes where possible; do not replace structured HTML with plain text or Markdown.
- If the input is plain text (no HTML tags), return improved plain text with line breaks; do not use Markdown (no **, #, backticks, or []() links).
- Do not wrap the output in markdown code fences. Do not include <html>, <head>, or <body> wrappers — return only the inner content fragment.

Return only the improved notes, no preamble or commentary.`;

export async function anthropicImproveNoteContent(userId: string, content: string): Promise<string> {
  return anthropicComplete(IMPROVE_NOTE_SYSTEM_PROMPT, content.slice(0, 200_000), {
    maxTokens: 8192,
    model: ANTHROPIC_MODEL_SONNET,
    usage: { userId },
  });
}

/** System prompt for Voice to Notes: raw Whisper text → structured study notes (Claude). */
export const VOICE_TRANSCRIPTION_IMPROVE_SYSTEM_PROMPT = `These are raw spoken lecture notes from a voice recording. Convert them into well-structured, detailed study notes. Fix any transcription errors, add proper formatting with headings and bullet points, expand on key concepts, organize the content logically by topic, and make them exam-ready. Preserve all the important information from the original transcription but present it in a clean, studyable format.

Output format (required):
- Return HTML only as a fragment for a rich text editor: use <h2> and <h3> for headings, <p> for paragraphs, <ul>/<ol>/<li> for lists, and <strong>/<em> where appropriate.
- Do not wrap the output in markdown code fences. Do not include <html>, <head>, or <body> wrappers.

Return only the improved notes, no preamble or commentary.`;

/**
 * Sends **plain-text** raw transcription from Whisper to Claude with {@link VOICE_TRANSCRIPTION_IMPROVE_SYSTEM_PROMPT}.
 */
export async function anthropicImproveVoiceTranscription(userId: string, rawTranscriptPlainText: string): Promise<string> {
  return anthropicComplete(VOICE_TRANSCRIPTION_IMPROVE_SYSTEM_PROMPT, rawTranscriptPlainText.slice(0, 200_000), {
    maxTokens: 8192,
    model: ANTHROPIC_MODEL_SONNET,
    usage: { userId },
  });
}
