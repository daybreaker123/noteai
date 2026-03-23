import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { extractPdfOrDocxTextFromBuffer } from "@/lib/extract-document-text";
import {
  NOTE_IMPORT_MAX_BYTES,
  NOTE_IMPORT_MAX_CHARS,
  noteTitleFromImportFileName,
} from "@/lib/note-import-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FREE_NOTE_LIMIT = 50;

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
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

  const categoryRaw = form.get("category_id");
  const categoryId =
    typeof categoryRaw === "string" && categoryRaw.trim() !== ""
      ? categoryRaw.trim()
      : null;

  const name = file.name || "document";
  const lower = name.toLowerCase();
  const isPdf = file.type === PDF_MIME || lower.endsWith(".pdf");
  const isDocx = file.type === DOCX_MIME || lower.endsWith(".docx");

  if (!isPdf && !isDocx) {
    return NextResponse.json(
      { error: "Please choose a PDF or Word document (.docx) file." },
      { status: 400 }
    );
  }

  if (file.size > NOTE_IMPORT_MAX_BYTES) {
    const mb = Math.round(NOTE_IMPORT_MAX_BYTES / (1024 * 1024));
    return NextResponse.json(
      { error: `That file is too large. Maximum size is ${mb}MB.` },
      { status: 400 }
    );
  }

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";
  if (plan !== "pro") {
    const { count } = await supabaseAdmin
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id);
    if ((count ?? 0) >= FREE_NOTE_LIMIT) {
      return NextResponse.json(
        {
          error: "You've reached the free limit — upgrade to Pro for unlimited notes",
          code: "FREE_LIMIT_NOTES",
        },
        { status: 402 }
      );
    }
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = await extractPdfOrDocxTextFromBuffer(buf, isPdf ? "pdf" : "docx");
  } catch (e) {
    console.error("[notes/import-document] extract", e);
    return NextResponse.json(
      {
        error:
          "We couldn't read that file. It may be corrupted, password-protected, or in an unsupported format. Try exporting again or use a smaller file.",
      },
      { status: 422 }
    );
  }

  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return NextResponse.json(
      {
        error:
          "No text could be extracted from this document. Scanned PDFs need OCR first, or the file may be empty.",
      },
      { status: 422 }
    );
  }

  let content = trimmed;
  let truncated = false;
  if (content.length > NOTE_IMPORT_MAX_CHARS) {
    content = content.slice(0, NOTE_IMPORT_MAX_CHARS);
    truncated = true;
  }

  const title = noteTitleFromImportFileName(name);

  const { data, error } = await supabaseAdmin
    .from("notes")
    .insert({
      user_id: session.user.id,
      category_id: categoryId,
      title,
      content,
      pinned: false,
      tags: [],
    })
    .select()
    .single();

  if (error) {
    console.error("[notes/import-document] insert", error);
    return NextResponse.json({ error: "Couldn't save your note. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ...data, truncated });
}
