import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, hasAnthropicKey } from "@/lib/anthropic";

const FREE_SUMMARY_LIMIT = 10;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
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
      .select("summarizations")
      .eq("user_id", session.user.id)
      .eq("month", month)
      .single();
    const used = usage?.summarizations ?? 0;
    if (used >= FREE_SUMMARY_LIMIT) {
      return NextResponse.json(
        {
          error: "You've reached the free limit of 10 summaries per month — upgrade to Pro for unlimited",
          code: "FREE_LIMIT_SUMMARIES",
        },
        { status: 402 }
      );
    }
  }

  const system = "Summarize the following note in 3-5 sentences. Be concise and capture the main points.";
  const userMessage = content.slice(0, 8000);

  try {
    const text = await anthropicComplete(system, userMessage, { maxTokens: 300 });

    if (plan !== "pro" && supabaseAdmin) {
      const month = new Date().toISOString().slice(0, 7);
      const { data: row } = await supabaseAdmin
        .from("ai_usage")
        .select("summarizations")
        .eq("user_id", session.user.id)
        .eq("month", month)
        .single();
      const current = row?.summarizations ?? 0;
      if (row) {
        await supabaseAdmin
          .from("ai_usage")
          .update({ summarizations: current + 1 })
          .eq("user_id", session.user.id)
          .eq("month", month);
      } else {
        await supabaseAdmin.from("ai_usage").insert({
          user_id: session.user.id,
          month,
          summarizations: 1,
        });
      }
    }

    return NextResponse.json({ summary: text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Summarization failed" },
      { status: 502 }
    );
  }
}
