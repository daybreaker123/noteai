import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  type FlashcardRating,
  computeNextSm2State,
  nextReviewAtIso,
  ratingToQuality,
  type Sm2CardState,
} from "@/lib/sm2-spaced-repetition";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as {
    study_set_id?: string;
    card_index?: number;
    rating?: FlashcardRating;
  } | null;

  const studySetId = typeof body?.study_set_id === "string" ? body.study_set_id.trim() : "";
  const cardIndex = typeof body?.card_index === "number" && Number.isInteger(body.card_index) ? body.card_index : -1;
  const rating = body?.rating;

  if (!UUID_RE.test(studySetId)) {
    return NextResponse.json({ error: "Invalid study_set_id" }, { status: 400 });
  }
  if (cardIndex < 0) {
    return NextResponse.json({ error: "Invalid card_index" }, { status: 400 });
  }
  if (rating !== "hard" && rating !== "good" && rating !== "easy") {
    return NextResponse.json({ error: "rating must be hard, good, or easy" }, { status: 400 });
  }

  const userId = session.user.id;

  const { data: row, error: fetchSetErr } = await supabaseAdmin
    .from("study_sets")
    .select("id, kind, payload")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .single();

  if (fetchSetErr || !row) {
    return NextResponse.json({ error: "Study set not found" }, { status: 404 });
  }
  if (row.kind !== "flashcards") {
    return NextResponse.json({ error: "Not a flashcard set" }, { status: 400 });
  }

  const cards = (row.payload as { cards?: unknown })?.cards;
  if (!Array.isArray(cards) || cardIndex >= cards.length) {
    return NextResponse.json({ error: "Invalid card index" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("flashcard_progress")
    .select("ease_factor, interval_days, repetitions")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId)
    .eq("card_index", cardIndex)
    .maybeSingle();

  const previous: Sm2CardState | null = existing
    ? {
        easeFactor: Number(existing.ease_factor),
        intervalDays: Number(existing.interval_days),
        repetitions: Number(existing.repetitions),
      }
    : null;

  const quality = ratingToQuality(rating);
  const nextState = computeNextSm2State(previous, quality);
  const nextAt = nextReviewAtIso(nextState.intervalDays);

  const upsertRow = {
    user_id: userId,
    study_set_id: studySetId,
    card_index: cardIndex,
    ease_factor: nextState.easeFactor,
    interval_days: nextState.intervalDays,
    repetitions: nextState.repetitions,
    next_review_at: nextAt,
    last_rating: rating,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabaseAdmin.from("flashcard_progress").upsert(upsertRow, {
    onConflict: "user_id,study_set_id,card_index",
  });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  const streak = await recordStudyActivity(userId);
  return NextResponse.json({
    ok: true,
    ease_factor: nextState.easeFactor,
    interval_days: nextState.intervalDays,
    repetitions: nextState.repetitions,
    next_review_at: nextAt,
    last_rating: rating,
    ...streakJson(streak),
  });
}
