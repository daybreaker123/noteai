export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Transcribe audio with OpenAI Whisper. `buffer` is raw file bytes; `mimeType` should match the recording.
 */
export async function transcribeAudioWithWhisper(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const type = mimeType?.trim() || "application/octet-stream";
  const blob = new Blob([new Uint8Array(buffer)], { type });
  const file = new File([blob], filename || "audio", { type });
  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Whisper transcription failed");
  }
  const json = (await res.json()) as { text?: string };
  const text = (json.text ?? "").trim();
  console.log("[openai-whisper] raw transcript from Whisper API:", text);
  return text;
}
