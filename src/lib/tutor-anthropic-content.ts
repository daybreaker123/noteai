/** Max decoded image size (bytes) — keep under typical serverless body limits */
export const TUTOR_MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const TUTOR_DEFAULT_IMAGE_PROMPT =
  "Please explain what's in this image and how I can help the student understand it.";

const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function isAllowedImageMediaType(m: string): boolean {
  return ALLOWED_MEDIA.has(m);
}

export type StoredImageAttachment = {
  type: "image";
  media_type: string;
  data: string;
};

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/** User message `content` for Anthropic: plain string or multimodal blocks */
export type AnthropicUserContent = string | AnthropicContentBlock[];

export function buildUserAnthropicContent(
  text: string,
  images: StoredImageAttachment[] | null | undefined
): AnthropicUserContent {
  if (!images?.length) return text;
  const blocks: AnthropicContentBlock[] = [];
  for (const img of images) {
    if (img.type === "image" && img.media_type && img.data) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: img.media_type, data: img.data },
      });
    }
  }
  blocks.push({ type: "text", text });
  return blocks;
}

export function parseAttachmentsFromDb(raw: unknown): StoredImageAttachment[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  const out: StoredImageAttachment[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      (item as StoredImageAttachment).type === "image" &&
      typeof (item as StoredImageAttachment).media_type === "string" &&
      typeof (item as StoredImageAttachment).data === "string"
    ) {
      out.push(item as StoredImageAttachment);
    }
  }
  return out.length ? out : null;
}

/** Strip data URL prefix and return raw base64 + media type if present */
export function normalizeBase64Payload(
  data: string,
  mediaTypeHint?: string
): { data: string; mediaType: string } | { error: string } {
  const trimmed = data.trim();
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
  if (m) {
    return { mediaType: m[1], data: m[2].replace(/\s/g, "") };
  }
  if (!trimmed) return { error: "Empty image data" };
  return { mediaType: mediaTypeHint ?? "image/jpeg", data: trimmed.replace(/\s/g, "") };
}

export function estimateBytesFromBase64(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

/** Read an image file as raw base64 + media type for the tutor API */
export function fileToImagePayloadFromFile(
  file: File
): Promise<{ mediaType: string; data: string } | { error: string }> {
  return new Promise((resolve) => {
    if (!isAllowedImageMediaType(file.type)) {
      resolve({ error: "Please use JPG, PNG, GIF, or WebP." });
      return;
    }
    if (file.size > TUTOR_MAX_IMAGE_BYTES) {
      resolve({ error: `Image too large (max ${TUTOR_MAX_IMAGE_BYTES / (1024 * 1024)}MB).` });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? "");
      const n = normalizeBase64Payload(res);
      if ("error" in n) {
        resolve({ error: n.error });
        return;
      }
      resolve({ mediaType: n.mediaType, data: n.data });
    };
    reader.onerror = () => resolve({ error: "Could not read file." });
    reader.readAsDataURL(file);
  });
}
