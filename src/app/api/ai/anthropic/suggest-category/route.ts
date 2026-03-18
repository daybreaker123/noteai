import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, hasAnthropicKey } from "@/lib/anthropic";

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
        error: "Auto-categorization is a Pro feature — upgrade to Pro",
        code: "PRO_REQUIRED_AUTO_CATEGORIZE",
      },
      { status: 402 }
    );
  }

  const { content, categoryIds, categoryNames } = (await req.json()) as {
    content?: string;
    categoryIds?: string[];
    categoryNames?: string[];
  };
  if (!content?.trim() || !categoryIds?.length || !categoryNames?.length) {
    return NextResponse.json(
      { error: "content, categoryIds, and categoryNames required" },
      { status: 400 }
    );
  }

  const catList = categoryNames.join(", ");
  const system = `You are a helpful assistant. Given the note content and the user's categories below, pick the single best category for this note. Return ONLY the exact category name (one of the options), nothing else. Categories: ${catList}`;
  const userMessage = `Note:\n${content.slice(0, 4000)}\n\nWhich category fits best?`;

  try {
    const text = await anthropicComplete(system, userMessage, { maxTokens: 50 });
    const idx = categoryNames.findIndex((n) => n.toLowerCase() === text.toLowerCase());
    const categoryId = idx >= 0 ? categoryIds[idx] : categoryIds[0];
    const categoryName = idx >= 0 ? categoryNames[idx] : categoryNames[0];
    return NextResponse.json({
      category: { id: categoryId, name: categoryName },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Suggestion failed" },
      { status: 502 }
    );
  }
}
