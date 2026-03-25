import { supabaseAdmin } from "@/lib/supabase-admin";
import type { StreakMilestone } from "@/lib/streak-client";

export type { StreakMilestone } from "@/lib/streak-client";

export type StreakPayload = {
  streak: { current: number; milestone: StreakMilestone | null };
};

export function streakJson(r: {
  current_streak: number;
  milestone: StreakMilestone | null;
}): StreakPayload {
  return { streak: { current: r.current_streak, milestone: r.milestone } };
}

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, day! + delta));
  return utcYmd(dt);
}

function parseCelebrated(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is number => typeof x === "number" && Number.isInteger(x));
}

const MILESTONES: StreakMilestone[] = [7, 30, 100];

/**
 * Call after a qualifying study action (note create, AI feature, flashcard rate, quiz complete).
 * Idempotent for the same UTC day: does not change streak if user already active today.
 */
export async function recordStudyActivity(userId: string): Promise<{
  current_streak: number;
  milestone: StreakMilestone | null;
}> {
  if (!supabaseAdmin) {
    return { current_streak: 0, milestone: null };
  }
  const id = userId.trim();
  if (!id) return { current_streak: 0, milestone: null };

  const today = utcYmd(new Date());
  const yesterday = addDaysYmd(today, -1);

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("user_stats")
    .select("current_streak, longest_streak, last_activity_date, celebrated_milestones")
    .eq("user_id", id)
    .maybeSingle();

  if (fetchErr) {
    console.warn("[user-study-stats] fetch user_stats failed:", fetchErr.message);
    return { current_streak: 0, milestone: null };
  }

  let currentStreak = row?.current_streak ?? 0;
  let longestStreak = row?.longest_streak ?? 0;
  let lastDate = row?.last_activity_date as string | null | undefined;
  let celebrated = parseCelebrated(row?.celebrated_milestones);

  if (lastDate === today) {
    return { current_streak: currentStreak, milestone: null };
  }

  let milestone: StreakMilestone | null = null;
  let newCelebrated = [...celebrated];

  if (!lastDate) {
    currentStreak = 1;
  } else if (lastDate === yesterday) {
    currentStreak = currentStreak + 1;
  } else {
    currentStreak = 1;
    newCelebrated = [];
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  for (const m of MILESTONES) {
    if (currentStreak === m && !newCelebrated.includes(m)) {
      milestone = m;
      newCelebrated.push(m);
      break;
    }
  }

  const upsert = {
    user_id: id,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_activity_date: today,
    celebrated_milestones: newCelebrated,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabaseAdmin.from("user_stats").upsert(upsert, {
    onConflict: "user_id",
  });

  if (upsertErr) {
    console.warn("[user-study-stats] upsert user_stats failed:", upsertErr.message);
    return { current_streak: row?.current_streak ?? 0, milestone: null };
  }

  return { current_streak: currentStreak, milestone };
}

function weekStartUtcIso(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff, 0, 0, 0, 0));
  return start.toISOString();
}

export type UserStatsDashboard = {
  current_streak: number;
  longest_streak: number;
  studied_today: boolean;
  total_notes: number;
  flashcard_sets_studied_this_week: number;
  quizzes_this_week: number;
  summarizations_this_month: number;
  recent_study_set_id: string | null;
  recent_study_set_title: string | null;
};

export async function getUserStatsDashboard(userId: string): Promise<UserStatsDashboard | null> {
  if (!supabaseAdmin) return null;
  const id = userId.trim();
  if (!id) return null;

  const today = utcYmd(new Date());
  const weekStart = weekStartUtcIso();
  const month = new Date().toISOString().slice(0, 7);

  const { data: statsRow } = await supabaseAdmin
    .from("user_stats")
    .select("current_streak, longest_streak, last_activity_date")
    .eq("user_id", id)
    .maybeSingle();

  const { count: noteCount } = await supabaseAdmin
    .from("notes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id);

  const { data: fpRows } = await supabaseAdmin
    .from("flashcard_progress")
    .select("study_set_id")
    .eq("user_id", id)
    .gte("updated_at", weekStart);

  const setIds = new Set<string>();
  for (const r of fpRows ?? []) {
    const sid = (r as { study_set_id?: string }).study_set_id;
    if (typeof sid === "string" && sid) setIds.add(sid);
  }

  const { count: quizCount } = await supabaseAdmin
    .from("quiz_completions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id)
    .gte("created_at", weekStart);

  const { data: usageRow } = await supabaseAdmin
    .from("ai_usage")
    .select("summarizations")
    .eq("user_id", id)
    .eq("month", month)
    .maybeSingle();

  const lastDate = statsRow?.last_activity_date as string | null | undefined;
  const studiedToday = lastDate === today;

  let recentStudySetId: string | null = null;
  let recentStudySetTitle: string | null = null;

  const { data: latestFp } = await supabaseAdmin
    .from("flashcard_progress")
    .select("study_set_id")
    .eq("user_id", id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fpSid = latestFp?.study_set_id as string | undefined;
  if (fpSid) {
    const { data: ss } = await supabaseAdmin
      .from("study_sets")
      .select("id, title, kind")
      .eq("id", fpSid)
      .eq("user_id", id)
      .maybeSingle();
    if (ss?.kind === "flashcards") {
      recentStudySetId = ss.id as string;
      recentStudySetTitle = typeof ss.title === "string" ? ss.title : "Study set";
    }
  }

  if (!recentStudySetId) {
    const { data: ssFallback } = await supabaseAdmin
      .from("study_sets")
      .select("id, title")
      .eq("user_id", id)
      .eq("kind", "flashcards")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ssFallback) {
      recentStudySetId = ssFallback.id as string;
      recentStudySetTitle = typeof ssFallback.title === "string" ? ssFallback.title : "Study set";
    }
  }

  return {
    current_streak: statsRow?.current_streak ?? 0,
    longest_streak: statsRow?.longest_streak ?? 0,
    studied_today: studiedToday,
    total_notes: noteCount ?? 0,
    flashcard_sets_studied_this_week: setIds.size,
    quizzes_this_week: quizCount ?? 0,
    summarizations_this_month: usageRow?.summarizations ?? 0,
    recent_study_set_id: recentStudySetId,
    recent_study_set_title: recentStudySetTitle,
  };
}

/** Insert quiz completion + streak (counts as study activity). */
export async function recordQuizCompletion(
  userId: string,
  studySetId: string | null
): Promise<{ current_streak: number; milestone: StreakMilestone | null }> {
  if (!supabaseAdmin) {
    return { current_streak: 0, milestone: null };
  }
  const id = userId.trim();
  if (!id) return { current_streak: 0, milestone: null };

  const sid =
    typeof studySetId === "string" && /^[0-9a-f-]{36}$/i.test(studySetId.trim()) ? studySetId.trim() : null;

  await supabaseAdmin.from("quiz_completions").insert({
    user_id: id,
    study_set_id: sid,
  });

  return recordStudyActivity(id);
}
