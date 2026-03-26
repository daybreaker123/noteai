import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAnthropicKey } from "@/lib/anthropic";
import { anthropicImproveNoteContent } from "@/lib/anthropic-improve-note";
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

  const { content, onboardingSampleNoteId } = (await req.json()) as {
    content?: string;
    onboardingSampleNoteId?: string;
  };
  if (!content?.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  let onboardingImprove = false;
  const sampleId = onboardingSampleNoteId?.trim();
  if (sampleId) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingCompletedAt: true, onboardingSampleNoteId: true },
    });
    if (u?.onboardingCompletedAt == null && u.onboardingSampleNoteId === sampleId) {
      onboardingImprove = true;
    }
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

  if (plan !== "pro" && supabaseAdmin && !onboardingImprove) {
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

  try {
    const text = await anthropicImproveNoteContent(session.user.id, content);

    if (plan !== "pro" && supabaseAdmin && !onboardingImprove) {
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
