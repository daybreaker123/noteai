import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, ANTHROPIC_MODEL_SONNET, hasAnthropicKey } from "@/lib/anthropic";
import { htmlToPlainText } from "@/lib/note-content-html";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";

const MAX_COMBINED_CHARS = 120_000;

const SYSTEM_PROMPT = `You are an expert academic tutor. Based on these student notes, generate a comprehensive, well-structured study guide for this subject. Include: an overview summary of the main topics, key concepts and definitions clearly explained, important facts and details organized by topic, connections between different concepts, likely exam topics based on what appears most in the notes, and a quick review checklist at the end. Format it clearly with headers, bullet points, and sections. Make it exam-ready.

Use Markdown: use ## for main sections, ### for subsections, bullet lists with - , and numbered lists where appropriate. Do not wrap the entire response in a code fence.`;

async function incrementStudyGuide(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const month = new Date().toISOString().slice(0, 7);
  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select("study_guide")
    .eq("user_id", userId)
    .eq("month", month)
    .single();
  const current = row?.study_guide ?? 0;
  if (row) {
    await supabaseAdmin
      .from("ai_usage")
      .update({ study_guide: current + 1 })
      .eq("user_id", userId)
      .eq("month", month);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      month,
      study_guide: 1,
    });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const userId = session.user.id;

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", userId)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";

  if (plan !== "pro") {
    return NextResponse.json(
      {
        error: "AI Study Guide is a Pro feature — upgrade to Pro",
        code: "PRO_REQUIRED_STUDY_GUIDE",
      },
      { status: 402 }
    );
  }

  const body = (await req.json()) as { category_id?: string };
  const categoryId = typeof body?.category_id === "string" ? body.category_id.trim() : "";
  if (!categoryId) {
    return NextResponse.json({ error: "category_id required" }, { status: 400 });
  }

  const { data: category, error: catErr } = await supabaseAdmin
    .from("categories")
    .select("id, name")
    .eq("id", categoryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (catErr || !category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const categoryName = typeof category.name === "string" ? category.name : "Category";

  const { data: notes, error: notesErr } = await supabaseAdmin
    .from("notes")
    .select("title, content")
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .order("updated_at", { ascending: false });

  if (notesErr) {
    return NextResponse.json({ error: notesErr.message }, { status: 500 });
  }

  const list = notes ?? [];
  if (list.length === 0) {
    return NextResponse.json(
      { error: "This category has no notes yet. Add notes before generating a study guide." },
      { status: 400 }
    );
  }

  let combined = "";
  for (const n of list) {
    const title = (n.title ?? "Untitled").trim() || "Untitled";
    const plain = htmlToPlainText(typeof n.content === "string" ? n.content : "").trim();
    const chunk = `## Note: ${title}\n\n${plain || "(empty)"}\n\n---\n\n`;
    if (combined.length + chunk.length > MAX_COMBINED_CHARS) {
      combined += "\n\n[Additional notes omitted — combined text reached size limit.]\n";
      break;
    }
    combined += chunk;
  }

  const userMessage = `Category: ${categoryName}\n\nStudent notes (multiple notes follow):\n\n${combined}`;

  try {
    const text = await anthropicComplete(SYSTEM_PROMPT, userMessage, {
      maxTokens: 8192,
      model: ANTHROPIC_MODEL_SONNET,
      usage: { userId },
    });

    await incrementStudyGuide(userId);
    const streak = await recordStudyActivity(userId);

    return NextResponse.json({
      study_guide: text,
      category_name: categoryName,
      category_id: categoryId,
      ...streakJson(streak),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Study guide generation failed" },
      { status: 502 }
    );
  }
}
