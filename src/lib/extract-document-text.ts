import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

/**
 * Extract plain text from a PDF or .docx buffer (server-side only).
 */
export async function extractPdfOrDocxTextFromBuffer(buf: Buffer, kind: "pdf" | "docx"): Promise<string> {
  if (kind === "pdf") {
    const parser = new PDFParse({ data: buf });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } finally {
      await parser.destroy();
    }
  }
  const result = await mammoth.extractRawText({ buffer: buf });
  if (result.messages?.length) {
    const errs = result.messages.filter((m) => m.type === "error").map((m) => m.message);
    if (errs.length) {
      console.warn("[extract-document-text] mammoth:", errs);
    }
  }
  return result.value ?? "";
}
