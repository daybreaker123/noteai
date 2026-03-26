import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, ANTHROPIC_MODEL_HAIKU, hasAnthropicKey } from "@/lib/anthropic";
import { parseConceptMapJson } from "@/lib/concept-map-types";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";
import { htmlToPlainText } from "@/lib/note-content-html";

const USER_PROMPT = `Analyze these notes and extract the key concepts and their relationships. Return a JSON object with this exact structure: { nodes: [{ id: string, label: string, description: string }], edges: [{ source: string, target: string, label: string }] }. Extract 8-15 key concepts as nodes and identify meaningful relationships between them as edges. Keep node labels short (1-4 words). Keep edge labels short (1-3 words describing the relationship like contains, causes, requires, produces, etc.).`;

const SYSTEM = `You output only valid JSON matching the user's schema. No markdown code fences, no commentary before or after the JSON. Use stable string ids for nodes (e.g. "n1", "n2" or short kebab-case).`;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const { content } = (await req.json()) as { content?: string };
  const plain = typeof content === "string" ? htmlToPlainText(content).trim() : "";
  if (!plain) {
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

  if (plan !== "pro") {
    return NextResponse.json(
      {
        error: "Concept Map is a Pro feature — upgrade to generate interactive concept maps from your notes.",
        code: "PRO_FEATURE_CONCEPT_MAP",
      },
      { status: 402 }
    );
  }

  const userMessage = `${USER_PROMPT}\n\n---\n\n${plain.slice(0, 100_000)}`;

  try {
    const raw = await anthropicComplete(SYSTEM, userMessage, {
      maxTokens: 4096,
      model: ANTHROPIC_MODEL_HAIKU,
      usage: { userId: session.user.id },
    });
    const graph = parseConceptMapJson(raw);
    if (!graph) {
      return NextResponse.json(
        { error: "Could not parse concept map from AI response. Try again with clearer notes." },
        { status: 502 }
      );
    }
    const streak = await recordStudyActivity(session.user.id);
    return NextResponse.json({ graph, ...streakJson(streak) });
  } catch (e) {
    console.error("[concept-map]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Concept map generation failed" },
      { status: 502 }
    );
  }
}
