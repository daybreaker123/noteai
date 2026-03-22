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
        error: "AI chat is a Pro feature — upgrade to Pro to chat across all your notes",
        code: "PRO_REQUIRED_CHAT",
      },
      { status: 402 }
    );
  }

  const { message } = (await req.json()) as { message?: string };
  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  let context = "";
  if (supabaseAdmin) {
    const { data: notes } = await supabaseAdmin
      .from("notes")
      .select("id, title, content")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    context = (notes ?? [])
      .map((n) => `[${n.title}]\n${(n.content ?? "").slice(0, 800)}`)
      .join("\n\n---\n\n");
  }

  const system = `You are a helpful assistant. The user has access to their notes. Use the following notes as context to answer their question. When referencing information, cite the note title in parentheses, e.g. (from: Meeting Notes). Be concise and helpful.\n\nNOTES:\n${context.slice(0, 80000)}`;

  try {
    const text = await anthropicComplete(system, message, {
      maxTokens: 1024,
      model: ANTHROPIC_MODEL_SONNET,
      usage: { userId: session.user.id },
    });
    return NextResponse.json({ reply: text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat request failed" },
      { status: 502 }
    );
  }
}
