import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, ANTHROPIC_MODEL_SONNET, hasAnthropicKey } from "@/lib/anthropic";

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

  const system = `You are an expert note-taker and tutor. Improve these student notes by:
1) Fixing any unclear or incomplete explanations and filling in gaps in understanding
2) Adding relevant context, examples, or detail that would help a student studying this topic
3) Correcting anything that seems factually uncertain (the user marked one item with ?? - address that)
4) Keeping the casual student voice but making it clearer and more complete
5) Using clear structure with line breaks and simple dashes or numbers for lists where helpful

Output rules (critical): Do not use any markdown formatting — no asterisks for bold or italic, no ** or __, no # headers, no backticks, no [links](). Return plain text only with clean spacing and line breaks so the note reads naturally in a simple text editor.

The result should feel like a smarter, more complete version of the original notes, not a corporate document. Return only the improved notes, no preamble.`;
  const userMessage = content.slice(0, 16000);

  try {
    const text = await anthropicComplete(system, userMessage, {
      maxTokens: 4000,
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

    return NextResponse.json({ improved: text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Improvement failed" },
      { status: 502 }
    );
  }
}
