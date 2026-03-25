import { NextResponse } from "next/server";
import { htmlToPlainText } from "@/lib/note-content-html";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, ANTHROPIC_MODEL_SONNET, hasAnthropicKey } from "@/lib/anthropic";
import { buildStudySetTitleFromNoteTitles } from "@/lib/study-set-utils";

const MAX_COMBINED_CHARS = 24_000;
const MAX_NOTE_IDS = 40;

/** Free users: one successful Study Multiple generation per calendar month (flashcards or quiz). */
const FREE_STUDY_MULTIPLE_LIMIT = 1;

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

async function incrementFreeStudyMultiple(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const month = currentMonthKey();
  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select("study_multiple")
    .eq("user_id", userId)
    .eq("month", month)
    .single();
  const current = row?.study_multiple ?? 0;
  if (row) {
    await supabaseAdmin
      .from("ai_usage")
      .update({ study_multiple: current + 1 })
      .eq("user_id", userId)
      .eq("month", month);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      month,
      study_multiple: 1,
    });
  }
}

/**
 * Generate flashcards or a quiz from multiple notes (combined content → single Claude call).
 * Persists each generation to study_sets. Pro: unlimited. Free: 1 use per month (ai_usage.study_multiple).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";

  const body = (await req.json()) as { kind?: "flashcards" | "quiz"; noteIds?: string[] };
  const kind = body.kind;
  const rawIds = Array.isArray(body.noteIds) ? body.noteIds : [];
  const noteIds = [...new Set(rawIds.map((id) => String(id).trim()).filter(Boolean))].filter(
    (id) => !id.startsWith("draft-")
  );

  if (noteIds.length === 0) {
    return NextResponse.json({ error: "Select at least one note" }, { status: 400 });
  }
  if (noteIds.length > MAX_NOTE_IDS) {
    return NextResponse.json({ error: `Too many notes (max ${MAX_NOTE_IDS})` }, { status: 400 });
  }
  if (kind !== "flashcards" && kind !== "quiz") {
    return NextResponse.json({ error: "kind must be flashcards or quiz" }, { status: 400 });
  }

  if (plan !== "pro") {
    const month = currentMonthKey();
    const { data: usage } = await supabaseAdmin
      .from("ai_usage")
      .select("study_multiple")
      .eq("user_id", session.user.id)
      .eq("month", month)
      .single();
    const used = usage?.study_multiple ?? 0;
    if (used >= FREE_STUDY_MULTIPLE_LIMIT) {
      return NextResponse.json(
        {
          error:
            "You've used your free Study Multiple session this month — upgrade to Pro for unlimited multi-note study sessions.",
          code: "FREE_LIMIT_STUDY_MULTIPLE",
        },
        { status: 402 }
      );
    }
  }

  const { data: rows, error: qErr } = await supabaseAdmin
    .from("notes")
    .select("id, title, content")
    .eq("user_id", session.user.id)
    .in("id", noteIds);

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }
  const list = rows ?? [];
  if (list.length === 0) {
    return NextResponse.json({ error: "No notes found" }, { status: 404 });
  }

  const byId = new Map(list.map((n) => [n.id, n]));
  const ordered = noteIds.map((id) => byId.get(id)).filter(Boolean) as { id: string; title: string | null; content: string | null }[];

  const parts = ordered.map((n) => {
    const title = (n.title ?? "Untitled").trim() || "Untitled";
    const raw = (n.content ?? "").trim() || "(empty)";
    const content = raw === "(empty)" ? raw : htmlToPlainText(raw);
    return `## ${title}\n\n${content}`;
  });
  let combined = parts.join("\n\n---\n\n");
  if (combined.length > MAX_COMBINED_CHARS) {
    combined = combined.slice(0, MAX_COMBINED_CHARS);
  }

  try {
    if (kind === "flashcards") {
      const system = `You are a study assistant. The user provided multiple notes (separated by ---). Extract 8-15 key concept pairs that cover the material across ALL notes. Return a JSON array of objects with "front" and "back" keys only. Example: [{"front":"What is X?","back":"X is..."}]`;
      const text = await anthropicComplete(
        system,
        `Create unified flashcards from these notes:\n\n${combined}`,
        {
          maxTokens: 4000,
          model: ANTHROPIC_MODEL_SONNET,
          usage: { userId: session.user.id },
        }
      );
      const parsed = JSON.parse(text.replace(/```json?\s*|\s*```/g, "")) as {
        front?: string;
        back?: string;
      }[];
      const cards = (Array.isArray(parsed) ? parsed : [])
        .filter((c) => c.front && c.back)
        .map((c) => ({ front: c.front!, back: c.back! }));

      const title = buildStudySetTitleFromNoteTitles(ordered.map((n) => n.title));
      const { error: insErr } = await supabaseAdmin.from("study_sets").insert({
        user_id: session.user.id,
        note_id: noteIds[0] ?? null,
        note_ids: noteIds,
        kind: "flashcards",
        title,
        payload: { cards },
      });
      if (insErr) console.error("[study/multi] study_sets insert flashcards", insErr);

      if (plan !== "pro") {
        await incrementFreeStudyMultiple(session.user.id);
      }
      return NextResponse.json({ cards });
    }

    const system = `You are a quiz assistant. The user provided multiple notes (separated by ---). Create 8 multiple choice questions that test understanding across ALL notes. Each question has 4 options and one correct answer (index 0-3). Include a one-sentence "explanation" for why the correct answer is right. Return JSON: {"questions":[{"question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}]}`;
    const text = await anthropicComplete(
      system,
      `Create a unified quiz from these notes:\n\n${combined}`,
      { maxTokens: 4000, model: ANTHROPIC_MODEL_SONNET, usage: { userId: session.user.id } }
    );
    const parsed = JSON.parse(text.replace(/```json?\s*|\s*```/g, "")) as {
      questions?: { question: string; options: string[]; correctIndex: number; explanation?: string }[];
    };
    const questions = (parsed.questions ?? []).slice(0, 10).map((q) => ({
      question: q.question ?? "",
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: Math.min(Math.max(0, q.correctIndex ?? 0), 3),
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : undefined,
    }));

    // Quizzes are not auto-persisted to study_sets — user saves explicitly from the results screen.

    if (plan !== "pro") {
      await incrementFreeStudyMultiple(session.user.id);
    }
    return NextResponse.json({ questions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 502 }
    );
  }
}
