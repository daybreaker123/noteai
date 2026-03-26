import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, ANTHROPIC_MODEL_SONNET, hasAnthropicKey } from "@/lib/anthropic";
import { extractPdfSlidesTextByPage, extractPptxSlidesText } from "@/lib/extract-lecture-slides-text";
import { NOTE_IMPORT_MAX_BYTES, NOTE_IMPORT_MAX_CHARS, noteTitleFromImportFileName } from "@/lib/note-import-utils";
import { normalizeImprovedNoteHtml } from "@/lib/note-content-html";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PDF_MIME = "application/pdf";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const LECTURE_USER_INSTRUCTIONS = `These are slides from a lecture. Convert them into comprehensive, well-structured study notes. For each major topic or slide section: expand on the key points with explanations, add context and detail that a student would need to understand the material, preserve any definitions, formulas, or important facts exactly as written, and organize everything with clear headings and bullet points. Make the notes more detailed and useful than the original slides.`;

const SYSTEM = `You are an expert study coach. The user message contains instructions followed by slide or PDF page text (marked with --- SLIDE CONTENT ---).

Return only HTML suitable for a rich text editor body fragment:
- Use <h2> and <h3> for section headings, <p> for paragraphs, <ul><li> for bullet lists, <strong> and <em> where helpful.
- Preserve definitions, formulas, and important facts exactly as in the source; use <code> for short formulas or symbols when appropriate.
- Do not use Markdown syntax. Do not wrap the output in markdown code fences. Do not include <html>, <head>, or <body> — only the inner fragment.
- If the source is sparse, still produce coherent, learnable notes.`;

const MAX_CLAUDE_INPUT = 200_000;

async function incrementSlidesAnalysis(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const month = new Date().toISOString().slice(0, 7);
  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select("slides_analysis")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();
  const next = (row?.slides_analysis ?? 0) + 1;
  if (row) {
    await supabaseAdmin
      .from("ai_usage")
      .update({ slides_analysis: next })
      .eq("user_id", userId)
      .eq("month", month);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      month,
      slides_analysis: 1,
    });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { error: "AI not configured. Add ANTHROPIC_API_KEY to your environment." },
      { status: 503 }
    );
  }

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";
  if (plan !== "pro") {
    return NextResponse.json(
      {
        error: "Analyze Slides is a Pro feature — upgrade to turn lectures into study notes.",
        code: "PRO_FEATURE_SLIDES_ANALYSIS",
      },
      { status: 402 }
    );
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
    typeof categoryRaw === "string" && categoryRaw.trim() !== "" ? categoryRaw.trim() : null;

  const name = file.name || "slides";
  const lower = name.toLowerCase();
  const isPdf = file.type === PDF_MIME || lower.endsWith(".pdf");
  const isPptx = file.type === PPTX_MIME || lower.endsWith(".pptx");

  if (!isPdf && !isPptx) {
    return NextResponse.json(
      { error: "Please choose a PowerPoint (.pptx) or PDF file." },
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

  const buf = Buffer.from(await file.arrayBuffer());
  let extracted: string;
  try {
    extracted = isPdf ? await extractPdfSlidesTextByPage(buf) : await extractPptxSlidesText(buf);
  } catch (e) {
    console.error("[analyze-slides] extract", e);
    return NextResponse.json(
      {
        error:
          "We couldn't read that file. It may be corrupted, password-protected, or use an unsupported format.",
      },
      { status: 422 }
    );
  }

  const trimmed = extracted.replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return NextResponse.json(
      {
        error:
          "No text could be extracted. Scanned PDFs need OCR first, or the slides may be image-only.",
      },
      { status: 422 }
    );
  }

  let slidePayload = trimmed;
  if (slidePayload.length > NOTE_IMPORT_MAX_CHARS) {
    slidePayload = slidePayload.slice(0, NOTE_IMPORT_MAX_CHARS);
  }

  const userMessage = `${LECTURE_USER_INSTRUCTIONS}\n\n--- SLIDE CONTENT ---\n\n${slidePayload}`.slice(
    0,
    MAX_CLAUDE_INPUT
  );

  let html: string;
  try {
    const raw = await anthropicComplete(SYSTEM, userMessage, {
      maxTokens: 8192,
      model: ANTHROPIC_MODEL_SONNET,
      usage: { userId: session.user.id },
    });
    html = normalizeImprovedNoteHtml(raw);
  } catch (e) {
    console.error("[analyze-slides] claude", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not generate notes from your slides." },
      { status: 502 }
    );
  }

  const title = noteTitleFromImportFileName(name);

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("notes")
    .insert({
      user_id: session.user.id,
      category_id: categoryId,
      title,
      content: html,
      pinned: false,
      tags: [],
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    console.error("[analyze-slides] insert", insertErr);
    return NextResponse.json({ error: "Couldn't save your note. Please try again." }, { status: 500 });
  }

  await incrementSlidesAnalysis(session.user.id);
  const streak = await recordStudyActivity(session.user.id);
  return NextResponse.json({ ...inserted, ...streakJson(streak) });
}
