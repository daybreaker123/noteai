import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { StudySetKind, StudySetSummary } from "@/lib/api-types";
import { parseConceptMapPayload } from "@/lib/concept-map-types";
import { studySetItemCount } from "@/lib/study-set-utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeNoteIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && UUID_RE.test(id) && !id.startsWith("draft-"));
}

/**
 * Save a flashcard or quiz payload to `study_sets` (explicit user save from the Study UI).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  if (planRow?.plan !== "pro") {
    return NextResponse.json(
      { error: "Saving study sets is a Pro feature", code: "PRO_REQUIRED_STUDY" },
      { status: 402 }
    );
  }

  const body = (await req.json()) as {
    kind?: StudySetKind;
    title?: string;
    note_id?: string | null;
    note_ids?: string[];
    payload?: { cards?: unknown[]; questions?: unknown[]; nodes?: unknown[]; edges?: unknown[] };
  };

  if (body.kind !== "flashcards" && body.kind !== "quiz" && body.kind !== "concept_map") {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const title = (body.title ?? "").trim() || "Study set";
  const payload = body.payload;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "payload required" }, { status: 400 });
  }

  let rowPayload: Record<string, unknown>;

  if (body.kind === "flashcards") {
    const cards = (payload as { cards?: unknown }).cards;
    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: "payload.cards must be a non-empty array" }, { status: 400 });
    }
    rowPayload = { cards: (payload as { cards: unknown[] }).cards };
  } else if (body.kind === "quiz") {
    const questions = (payload as { questions?: unknown }).questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "payload.questions must be a non-empty array" }, { status: 400 });
    }
    rowPayload = { questions: (payload as { questions: unknown[] }).questions };
  } else {
    const graph = parseConceptMapPayload(payload);
    if (!graph) {
      return NextResponse.json({ error: "Invalid concept map payload" }, { status: 400 });
    }
    rowPayload = { nodes: graph.nodes, edges: graph.edges };
  }

  let noteIds = sanitizeNoteIds(body.note_ids);
  const single = body.note_id && typeof body.note_id === "string" ? body.note_id : null;
  if (single && UUID_RE.test(single) && !single.startsWith("draft-")) {
    if (!noteIds.includes(single)) noteIds = [single, ...noteIds];
  }
  if (noteIds.length === 0 && single && UUID_RE.test(single)) {
    noteIds = [single];
  }

  const noteIdForRow = noteIds[0] ?? null;

  const studySetKind = body.kind;

  const { data, error } = await supabaseAdmin
    .from("study_sets")
    .insert({
      user_id: session.user.id,
      note_id: noteIdForRow,
      note_ids: noteIds,
      kind: studySetKind,
      title,
      payload: rowPayload,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ sets: [] as StudySetSummary[] });
  }

  const { data, error } = await supabaseAdmin
    .from("study_sets")
    .select("id, title, kind, payload, created_at, note_id, note_ids")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sets: StudySetSummary[] = (data ?? []).map((row) => {
    const rawIds = row.note_ids;
    const note_ids = Array.isArray(rawIds) ? rawIds.map((x) => String(x)) : undefined;
    return {
      id: row.id,
      title: row.title ?? "Study set",
      kind: row.kind as StudySetKind,
      created_at: row.created_at ?? new Date().toISOString(),
      item_count: studySetItemCount(row.kind as StudySetKind, row.payload),
      note_id: row.note_id ?? null,
      note_ids,
    };
  });

  return NextResponse.json({ sets });
}
