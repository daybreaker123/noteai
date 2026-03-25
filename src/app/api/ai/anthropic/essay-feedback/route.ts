import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  anthropicComplete,
  ANTHROPIC_MODEL_HAIKU,
  ANTHROPIC_MODEL_SONNET,
  hasAnthropicKey,
} from "@/lib/anthropic";
import { ESSAY_ANNOTATION_SYSTEM_PROMPT } from "@/lib/essay-annotation-prompt";
import { parseAnnotationsJson } from "@/lib/essay-annotations";
import { ESSAY_FEEDBACK_SYSTEM_PROMPT } from "@/lib/essay-feedback-prompt";
import type { EssayAnnotation } from "@/lib/essay-annotation-types";
import {
  parseEssayFeedbackJson,
  structuredToBasicMarkdown,
  structuredToPlainText,
  toFreeTierStructured,
  type EssayFeedbackStructured,
} from "@/lib/essay-feedback-types";
import { ESSAY_TYPE_OPTIONS, GRADE_LEVEL_OPTIONS } from "@/lib/essay-feedback-options";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";

export const runtime = "nodejs";

const FREE_ESSAY_FEEDBACK_LIMIT = 3;
const MAX_ESSAY_CHARS = 80_000;

const ESSAY_TYPES_LIST = ESSAY_TYPE_OPTIONS.map((o) => o.value);
const GRADE_LEVELS_LIST = GRADE_LEVEL_OPTIONS.map((o) => o.value);

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({
      plan: "pro",
      essayFeedbackUsed: 0,
      essayFeedbackLimit: null as number | null,
      essayFeedbackRemaining: null as number | null,
    });
  }

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", userId)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";

  const month = currentMonth();
  const { data: usage } = await supabaseAdmin
    .from("ai_usage")
    .select("essay_feedback")
    .eq("user_id", userId)
    .eq("month", month)
    .single();

  const used = usage?.essay_feedback ?? 0;
  if (plan === "pro") {
    return NextResponse.json({
      plan,
      essayFeedbackUsed: used,
      essayFeedbackLimit: null,
      essayFeedbackRemaining: null,
    });
  }

  return NextResponse.json({
    plan,
    essayFeedbackUsed: used,
    essayFeedbackLimit: FREE_ESSAY_FEEDBACK_LIMIT,
    essayFeedbackRemaining: Math.max(0, FREE_ESSAY_FEEDBACK_LIMIT - used),
  });
}

async function incrementEssayFeedback(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const month = currentMonth();
  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select("essay_feedback")
    .eq("user_id", userId)
    .eq("month", month)
    .single();
  const current = row?.essay_feedback ?? 0;
  if (row) {
    await supabaseAdmin
      .from("ai_usage")
      .update({ essay_feedback: current + 1 })
      .eq("user_id", userId)
      .eq("month", month);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      month,
      essay_feedback: 1,
    });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured. Add ANTHROPIC_API_KEY to your environment." }, { status: 503 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = (await req.json()) as {
    essay?: string;
    essayType?: string;
    gradeLevel?: string;
  };

  const essay = typeof body.essay === "string" ? body.essay.trim() : "";
  if (!essay) {
    return NextResponse.json({ error: "Please paste or type your essay." }, { status: 400 });
  }
  if (essay.length > MAX_ESSAY_CHARS) {
    return NextResponse.json(
      { error: `Essay is too long (max ${MAX_ESSAY_CHARS.toLocaleString()} characters).` },
      { status: 400 }
    );
  }

  const essayTypeRaw = typeof body.essayType === "string" ? body.essayType.trim() : "";
  const essayType =
    ESSAY_TYPES_LIST.find((t) => t.toLowerCase() === essayTypeRaw.toLowerCase()) ?? null;
  if (!essayType) {
    return NextResponse.json({ error: "Invalid essay type." }, { status: 400 });
  }

  const gradeRaw = typeof body.gradeLevel === "string" ? body.gradeLevel.trim() : "";
  const gradeLevel =
    GRADE_LEVELS_LIST.find((g) => g.toLowerCase() === gradeRaw.toLowerCase()) ?? null;
  if (!gradeLevel) {
    return NextResponse.json({ error: "Invalid grade level." }, { status: 400 });
  }

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", userId)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";

  const month = currentMonth();
  if (plan !== "pro") {
    const { data: usage } = await supabaseAdmin
      .from("ai_usage")
      .select("essay_feedback")
      .eq("user_id", userId)
      .eq("month", month)
      .single();
    const used = usage?.essay_feedback ?? 0;
    if (used >= FREE_ESSAY_FEEDBACK_LIMIT) {
      return NextResponse.json(
        {
          error:
            "You've used all 3 free basic feedbacks this month — upgrade to Pro for unlimited advanced feedback.",
          code: "FREE_LIMIT_ESSAY_FEEDBACK",
        },
        { status: 402 }
      );
    }
  }

  const userMessage = `The student is writing a **${essayType}** essay at the **${gradeLevel}** level. Calibrate your expectations, vocabulary, and grade estimate for that level.

---

## Student essay

${essay}`;

  try {
    const feedback = await anthropicComplete(ESSAY_FEEDBACK_SYSTEM_PROMPT, userMessage, {
      maxTokens: 8192,
      model: ANTHROPIC_MODEL_SONNET,
      usage: { userId },
    });

    const feedbackStructuredFull: EssayFeedbackStructured | null = parseEssayFeedbackJson(feedback);

    let annotations: EssayAnnotation[] = [];
    if (plan === "pro" && feedbackStructuredFull) {
      const feedbackPlainForContext = structuredToPlainText({
        ...feedbackStructuredFull,
        gradeLocked: false,
      });
      try {
        const feedbackCtx = feedbackPlainForContext.slice(0, 1500);
        const annotateUserMsg = `## Student essay (copy spans ONLY from this text)\n\n${essay}\n\n## Written feedback (context only — do not quote this unless it also appears verbatim in the essay)\n\n${feedbackCtx}${feedbackPlainForContext.length > 1500 ? "\n\n[truncated]" : ""}`;
        const rawJson = await anthropicComplete(ESSAY_ANNOTATION_SYSTEM_PROMPT, annotateUserMsg, {
          maxTokens: 4096,
          model: ANTHROPIC_MODEL_HAIKU,
          usage: { userId },
        });
        annotations = parseAnnotationsJson(rawJson);
      } catch (e) {
        console.warn("[essay-feedback] annotation pass failed", e);
      }
    }

    let responseStructured: EssayFeedbackStructured | null = feedbackStructuredFull;
    let responseFeedback: string = feedback;
    const essayFeedbackTier = plan === "pro" ? "advanced" : "basic";
    if (plan !== "pro" && feedbackStructuredFull) {
      responseStructured = toFreeTierStructured(feedbackStructuredFull);
      responseFeedback = structuredToBasicMarkdown(responseStructured);
    } else if (plan !== "pro") {
      responseStructured = null;
      responseFeedback = "";
    }

    await incrementEssayFeedback(userId);

    const { data: after } = await supabaseAdmin
      .from("ai_usage")
      .select("essay_feedback")
      .eq("user_id", userId)
      .eq("month", month)
      .single();
    const usedAfter = after?.essay_feedback ?? 0;

    const streak = await recordStudyActivity(userId);
    return NextResponse.json({
      feedback: responseFeedback,
      feedbackStructured: responseStructured,
      annotations,
      plan,
      essayFeedbackTier,
      essayFeedbackUsed: usedAfter,
      essayFeedbackLimit: plan === "pro" ? null : FREE_ESSAY_FEEDBACK_LIMIT,
      essayFeedbackRemaining:
        plan === "pro" ? null : Math.max(0, FREE_ESSAY_FEEDBACK_LIMIT - usedAfter),
      ...streakJson(streak),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Essay feedback failed" },
      { status: 502 }
    );
  }
}
