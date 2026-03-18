const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

export function hasAnthropicKey(): boolean {
  return !!ANTHROPIC_API_KEY;
}

export async function anthropicComplete(
  system: string,
  userMessage: string,
  options?: { maxTokens?: number }
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: options?.maxTokens ?? 1024,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Anthropic API request failed");
  }
  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  return json.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
}

export async function anthropicStream(
  system: string,
  userMessage: string,
  onChunk: (text: string) => void,
  options?: { maxTokens?: number }
): Promise<void> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: options?.maxTokens ?? 1024,
      system,
      messages: [{ role: "user", content: userMessage }],
      stream: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Anthropic API request failed");
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta?.text) {
            onChunk(parsed.delta.text);
          }
        } catch {
          // skip malformed
        }
      }
    }
  }
}
