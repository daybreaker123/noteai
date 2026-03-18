import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, hasAnthropicKey } from "@/lib/anthropic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ flashcards: null, quiz: null });
  }
  const { noteId } = await params;
  let plan: "free" | "pro" = "free";
  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  plan = planRow?.plan === "pro" ? "pro" : "free";
  if (plan !== "pro") {
    return NextResponse.json(
      {
        error: "Study Mode is a Pro feature — upgrade to Pro",
        code: "PRO_REQUIRED_STUDY",
      },
      { status: 402 }
    );
  }
  const { data: flashcards } = await supabaseAdmin
    .from("study_sets")
    .select("payload")
    .eq("user_id", session.user.id)
    .eq("note_id", noteId)
    .eq("kind", "flashcards")
    .single();
  const { data: quiz } = await supabaseAdmin
    .from("study_sets")
    .select("payload")
    .eq("user_id", session.user.id)
    .eq("note_id", noteId)
    .eq("kind", "quiz")
    .single();
  return NextResponse.json({
    flashcards: flashcards?.payload ?? null,
    quiz: quiz?.payload ?? null,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }
  const { noteId } = await params;
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
        error: "Study Mode is a Pro feature — upgrade to Pro",
        code: "PRO_REQUIRED_STUDY",
      },
      { status: 402 }
    );
  }
  const body = (await req.json()) as { kind?: "flashcards" | "quiz"; content?: string; title?: string };
  const { kind, content: bodyContent, title: bodyTitle } = body;
  if (kind !== "flashcards" && kind !== "quiz") {
    return NextResponse.json({ error: "kind must be flashcards or quiz" }, { status: 400 });
  }

  let content: string;
  if (bodyContent?.trim()) {
    content = `${bodyTitle ?? "Note"}\n\n${bodyContent}`.slice(0, 8000);
  } else if (supabaseAdmin && !noteId.startsWith("draft-")) {
    const { data: note } = await supabaseAdmin
      .from("notes")
      .select("content, title")
      .eq("id", noteId)
      .eq("user_id", session.user.id)
      .single();
    if (!note?.content) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    content = `${note.title}\n\n${note.content}`.slice(0, 8000);
  } else {
    return NextResponse.json({ error: "Note content required" }, { status: 400 });
  }

  const isDraft = noteId.startsWith("draft-");

  try {
    if (kind === "flashcards") {
      const system = `You are a study assistant. Extract 5-10 key concept pairs from the note. Return a JSON array of objects with "front" and "back" keys only. Example: [{"front":"What is X?","back":"X is..."}]`;
      const text = await anthropicComplete(system, `Create flashcards from this note:\n\n${content}`, {
        maxTokens: 2000,
      });
      const parsed = JSON.parse(text.replace(/```json?\s*|\s*```/g, "")) as {
        front?: string;
        back?: string;
      }[];
      const cards = (Array.isArray(parsed) ? parsed : [])
        .filter((c) => c.front && c.back)
        .map((c) => ({ front: c.front!, back: c.back! }));
      if (!isDraft && supabaseAdmin) {
        await supabaseAdmin.from("study_sets").upsert(
          {
            user_id: session.user.id,
            note_id: noteId,
            kind: "flashcards",
            payload: { cards },
          },
          { onConflict: "user_id,note_id,kind" }
        );
      }
      return NextResponse.json({ cards });
    } else {
      const system = `You are a quiz assistant. Create 5 multiple choice questions from the note. Each question has 4 options and one correct answer (index 0-3). Return JSON: {"questions":[{"question":"...","options":["a","b","c","d"],"correctIndex":0}]}`;
      const text = await anthropicComplete(system, `Create a quiz from this note:\n\n${content}`, {
        maxTokens: 2000,
      });
      const parsed = JSON.parse(text.replace(/```json?\s*|\s*```/g, "")) as {
        questions?: { question: string; options: string[]; correctIndex: number }[];
      };
      const questions = (parsed.questions ?? []).slice(0, 5).map((q) => ({
        question: q.question ?? "",
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: Math.min(Math.max(0, q.correctIndex ?? 0), 3),
      }));
      if (!isDraft && supabaseAdmin) {
        await supabaseAdmin.from("study_sets").upsert(
          {
            user_id: session.user.id,
            note_id: noteId,
            kind: "quiz",
            payload: { questions },
          },
          { onConflict: "user_id,note_id,kind" }
        );
      }
      return NextResponse.json({ questions });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 502 }
    );
  }
}
