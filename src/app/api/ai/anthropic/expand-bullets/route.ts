import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, ANTHROPIC_MODEL_SONNET, hasAnthropicKey } from "@/lib/anthropic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
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

  if (plan !== "pro") {
    return NextResponse.json(
      {
        error: "AI writing assistant is a Pro feature — upgrade to Pro",
        code: "PRO_REQUIRED_WRITING",
      },
      { status: 402 }
    );
  }

  const { content } = (await req.json()) as { content?: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const system = `You are a writing assistant. Expand and improve the note content. If it contains bullet points, expand them into full, well-written paragraphs. Improve clarity, flow, and structure. Preserve the user's tone and voice. Keep headings and overall structure. Do not add new sections or change the overall structure. Return the expanded and improved note as markdown.`;
  const userMessage = `Expand and improve this note:\n\n${content.slice(0, 8000)}`;

  try {
    const text = await anthropicComplete(system, userMessage, {
      maxTokens: 4000,
      model: ANTHROPIC_MODEL_SONNET,
      usage: { userId: session.user.id },
    });
    return NextResponse.json({ expanded: text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Expansion failed" },
      { status: 502 }
    );
  }
}
