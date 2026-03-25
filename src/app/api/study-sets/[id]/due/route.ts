import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { endOfTodayUtc, isCardDueToday } from "@/lib/flashcard-due";

type Card = { front: string; back: string };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const userId = session.user.id;
  const endToday = endOfTodayUtc();

  const { data: row, error } = await supabaseAdmin
    .from("study_sets")
    .select("id, title, kind, payload")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Study set not found" }, { status: 404 });
  }
  if (row.kind !== "flashcards") {
    return NextResponse.json({ error: "Not a flashcard set" }, { status: 400 });
  }

  const rawCards = (row.payload as { cards?: unknown })?.cards;
  if (!Array.isArray(rawCards)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const allCards: Card[] = rawCards.map((c) => {
    const o = c as { front?: string; back?: string };
    return { front: String(o?.front ?? ""), back: String(o?.back ?? "") };
  });

  const { data: progressRows } = await supabaseAdmin
    .from("flashcard_progress")
    .select("card_index, next_review_at")
    .eq("user_id", userId)
    .eq("study_set_id", id);

  const pmap = new Map<number, string>();
  for (const p of progressRows ?? []) {
    pmap.set(p.card_index as number, p.next_review_at as string);
  }

  const originalIndices: number[] = [];
  const cards: Card[] = [];
  for (let i = 0; i < allCards.length; i++) {
    const next = pmap.get(i);
    if (isCardDueToday(next ?? null, endToday)) {
      originalIndices.push(i);
      cards.push(allCards[i]!);
    }
  }

  return NextResponse.json({
    id: row.id,
    title: row.title ?? "Study set",
    cards,
    original_indices: originalIndices,
    due_total: cards.length,
  });
}
