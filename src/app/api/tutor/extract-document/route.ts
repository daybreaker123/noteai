import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TUTOR_DOCUMENT_MAX_BYTES, TUTOR_EXTRACTED_TEXT_MAX_CHARS } from "@/lib/tutor-chat-attachments";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Video files are not supported" }, { status: 400 });
  }

  const name = file.name || "document";
  const lower = name.toLowerCase();
  const isPdf = file.type === PDF_MIME || lower.endsWith(".pdf");
  const isDocx = file.type === DOCX_MIME || lower.endsWith(".docx");

  if (!isPdf && !isDocx) {
    return NextResponse.json({ error: "Only PDF and Word (.docx) documents are supported here" }, { status: 400 });
  }

  if (file.size > TUTOR_DOCUMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(TUTOR_DOCUMENT_MAX_BYTES / (1024 * 1024))}MB)` },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let text = "";

  try {
    if (isPdf) {
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      await parser.destroy();
      text = result.text ?? "";
    } else {
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value ?? "";
      if (result.messages?.length) {
        const warns = result.messages.filter((m) => m.type === "error").map((m) => m.message);
        if (warns.length) {
          console.warn("[tutor/extract-document] mammoth messages:", warns);
        }
      }
    }
  } catch (e) {
    console.error("[tutor/extract-document]", e);
    return NextResponse.json({ error: "Could not read this file. Try another export or a smaller file." }, { status: 422 });
  }

  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "No text could be extracted from this file" }, { status: 422 });
  }

  let truncated = false;
  let out = trimmed;
  if (out.length > TUTOR_EXTRACTED_TEXT_MAX_CHARS) {
    out = out.slice(0, TUTOR_EXTRACTED_TEXT_MAX_CHARS);
    truncated = true;
  }

  return NextResponse.json({
    text: out,
    fileName: name,
    truncated,
  });
}
