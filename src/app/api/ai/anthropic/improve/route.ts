import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, ANTHROPIC_MODEL_SONNET, hasAnthropicKey } from "@/lib/anthropic";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";

const FREE_IMPROVE_LIMIT = 5;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured. Add ANTHROPIC_API_KEY to your environment." }, { status: 503 });
  }

  const { content } = (await req.json()) as { content?: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  let plan: "free" | "pro" = "free";
  if (supabaseAdmin) {
    const { data: planRow } = await supabaseAdmin
      .from("user_plans")
      .select("plan")
      .eq("user_id", session.user.id)
      .single();
    plan = planRow?.plan === "pro" ? "pro" : "free";
  } else {
    plan = "pro";
  }

  if (plan !== "pro" && supabaseAdmin) {
    const month = new Date().toISOString().slice(0, 7);
    const { data: usage } = await supabaseAdmin
      .from("ai_usage")
      .select("improvements")
      .eq("user_id", session.user.id)
      .eq("month", month)
      .single();
    const used = usage?.improvements ?? 0;
    if (used >= FREE_IMPROVE_LIMIT) {
      return NextResponse.json(
        {
          error: "You've used all 5 free improvements this month — upgrade to Pro for unlimited access.",
          code: "FREE_LIMIT_IMPROVEMENTS",
        },
        { status: 402 }
      );
    }
  }

  const system = `You are an expert note-taker and tutor. The user message is note content: it may be HTML (from a rich editor) or plain text for older notes.

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
  const userMessage = content.slice(0, 200_000);

  try {
    const text = await anthropicComplete(system, userMessage, {
      maxTokens: 8192,
      model: ANTHROPIC_MODEL_SONNET,
      usage: { userId: session.user.id },
    });

    if (plan !== "pro" && supabaseAdmin) {
      const month = new Date().toISOString().slice(0, 7);
      const { data: row } = await supabaseAdmin
        .from("ai_usage")
        .select("improvements")
        .eq("user_id", session.user.id)
        .eq("month", month)
        .single();
      const current = row?.improvements ?? 0;
      if (row) {
        await supabaseAdmin
          .from("ai_usage")
          .update({ improvements: current + 1 })
          .eq("user_id", session.user.id)
          .eq("month", month);
      } else {
        await supabaseAdmin.from("ai_usage").insert({
          user_id: session.user.id,
          month,
          summarizations: 0,
          improvements: 1,
        });
      }
    }

    const streak = await recordStudyActivity(session.user.id);
    return NextResponse.json({ improved: text, ...streakJson(streak) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Improvement failed" },
      { status: 502 }
    );
  }
}
