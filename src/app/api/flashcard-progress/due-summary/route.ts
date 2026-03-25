import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { endOfTodayUtc, isCardDueToday } from "@/lib/flashcard-due";
import type { FlashcardDueSummaryItem } from "@/lib/flashcard-progress-types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ items: [] as FlashcardDueSummaryItem[] });
  }

  const userId = session.user.id;
  const endToday = endOfTodayUtc();

  const { data: sets, error: setsErr } = await supabaseAdmin
    .from("study_sets")
    .select("id, title, kind, payload")
    .eq("user_id", userId)
    .eq("kind", "flashcards");

  if (setsErr || !sets?.length) {
    return NextResponse.json({ items: [] as FlashcardDueSummaryItem[] });
  }

  const setIds = sets.map((s) => s.id);
  const { data: progressRows } = await supabaseAdmin
    .from("flashcard_progress")
    .select("study_set_id, card_index, next_review_at")
    .eq("user_id", userId)
    .in("study_set_id", setIds);

  const bySet = new Map<string, Map<number, string>>();
  for (const p of progressRows ?? []) {
    const sid = p.study_set_id as string;
    const idx = p.card_index as number;
    const nr = p.next_review_at as string;
    if (!bySet.has(sid)) bySet.set(sid, new Map());
    bySet.get(sid)!.set(idx, nr);
  }

  const items: FlashcardDueSummaryItem[] = [];

  for (const s of sets) {
    const cards = (s.payload as { cards?: unknown[] })?.cards;
    if (!Array.isArray(cards) || cards.length === 0) continue;

    const pmap = bySet.get(s.id) ?? new Map();
    let due = 0;
    for (let i = 0; i < cards.length; i++) {
      const next = pmap.get(i);
      if (isCardDueToday(next ?? null, endToday)) due++;
    }

    if (due > 0) {
      items.push({
        id: s.id,
        title: (s.title as string) || "Study set",
        due_count: due,
        total_cards: cards.length,
      });
    }
  }

  items.sort((a, b) => b.due_count - a.due_count);
  return NextResponse.json({ items });
}
