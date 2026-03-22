import { recordProApiSpendEstimate, resolveAnthropicModelForProUser } from "@/lib/pro-api-usage";
import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from "@/lib/anthropic-models";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from "@/lib/anthropic-models";

/** Same as {@link ANTHROPIC_MODEL_SONNET} (backward compatible export). */
export const ANTHROPIC_MODEL = ANTHROPIC_MODEL_SONNET;

export type AnthropicCompleteOptions = {
  maxTokens?: number;
  /** Defaults to Sonnet. Use {@link ANTHROPIC_MODEL_HAIKU} for lighter tasks. */
  model?: string;
  /**
   * When set, Pro users past the soft spend limit use Haiku instead of Sonnet,
   * and successful calls increment estimated monthly spend.
   */
  usage?: { userId: string; variant?: "complete" | "stream" };
};

export type AnthropicStreamOptions = AnthropicCompleteOptions;

export function hasAnthropicKey(): boolean {
  return !!ANTHROPIC_API_KEY;
}

export async function anthropicComplete(
  system: string,
  userMessage: string,
  options?: AnthropicCompleteOptions
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  let model = options?.model ?? ANTHROPIC_MODEL_SONNET;
  let estimateCents = 0;
  if (options?.usage?.userId) {
    const variant = options.usage.variant ?? "complete";
    const resolved = await resolveAnthropicModelForProUser(options.usage.userId, model, variant);
    model = resolved.model;
    estimateCents = resolved.estimateCents;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
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
  const text = json.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (options?.usage?.userId && estimateCents > 0) {
    await recordProApiSpendEstimate(options.usage.userId, estimateCents);
  }
  return text;
}

export async function anthropicStream(
  system: string,
  userMessage: string,
  onChunk: (text: string) => void,
  options?: AnthropicStreamOptions
): Promise<void> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  let model = options?.model ?? ANTHROPIC_MODEL_SONNET;
  let estimateCents = 0;
  if (options?.usage?.userId) {
    const resolved = await resolveAnthropicModelForProUser(
      options.usage.userId,
      model,
      options.usage.variant ?? "stream"
    );
    model = resolved.model;
    estimateCents = resolved.estimateCents;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
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
  if (options?.usage?.userId && estimateCents > 0) {
    await recordProApiSpendEstimate(options.usage.userId, estimateCents);
  }
}
