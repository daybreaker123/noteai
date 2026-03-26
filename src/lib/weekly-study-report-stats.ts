import { supabaseAdmin } from "@/lib/supabase-admin";

export type WeeklyStudyReportStats = {
  currentStreak: number;
  notesCreated: number;
  flashcardSetsStudied: number;
  quizzesTaken: number;
  summarizationsUsed: number;
  essayFeedbacksReceived: number;
  topCategoryName: string | null;
  /** Sum of primary activity signals for tiering message */
  activityScore: number;
};

function rollingWeekStartIso(now: Date): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - 7);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function activityCutoffYmd(now: Date): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}

/**
 * Past 7×24h rolling window from `now` (aligned to UTC midnight start of day 7 days ago).
 */
export async function computeWeeklyStudyReportStats(
  userId: string,
  now: Date = new Date()
): Promise<WeeklyStudyReportStats | null> {
  if (!supabaseAdmin) return null;
  const id = userId.trim();
  if (!id) return null;

  const sinceIso = rollingWeekStartIso(now);

  const { data: statsRow } = await supabaseAdmin
    .from("user_stats")
    .select("current_streak")
    .eq("user_id", id)
    .maybeSingle();

  const { count: notesCreated } = await supabaseAdmin
    .from("notes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id)
    .gte("created_at", sinceIso);

  const { data: fpRows } = await supabaseAdmin
    .from("flashcard_progress")
    .select("study_set_id")
    .eq("user_id", id)
    .gte("updated_at", sinceIso);

  const flashSetIds = new Set<string>();
  for (const r of fpRows ?? []) {
    const sid = (r as { study_set_id?: string }).study_set_id;
    if (typeof sid === "string" && sid) flashSetIds.add(sid);
  }

  const { count: quizzesTaken } = await supabaseAdmin
    .from("quiz_completions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id)
    .gte("created_at", sinceIso);

  const { count: summarizationsUsed } = await supabaseAdmin
    .from("notes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id)
    .not("summarized_at", "is", null)
    .gte("summarized_at", sinceIso);

  const month = now.toISOString().slice(0, 7);
  const { data: usageRow } = await supabaseAdmin
    .from("ai_usage")
    .select("essay_feedback")
    .eq("user_id", id)
    .eq("month", month)
    .maybeSingle();
  const essayFeedbacksReceived = usageRow?.essay_feedback ?? 0;

  const topCategoryName = await resolveTopStudiedCategoryName(id, sinceIso);

  const activityScore =
    (notesCreated ?? 0) +
    flashSetIds.size +
    (quizzesTaken ?? 0) +
    (summarizationsUsed ?? 0);

  return {
    currentStreak: statsRow?.current_streak ?? 0,
    notesCreated: notesCreated ?? 0,
    flashcardSetsStudied: flashSetIds.size,
    quizzesTaken: quizzesTaken ?? 0,
    summarizationsUsed: summarizationsUsed ?? 0,
    essayFeedbacksReceived,
    topCategoryName,
    activityScore,
  };
}

async function resolveTopStudiedCategoryName(userId: string, sinceIso: string): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const setIds = new Set<string>();

  const { data: fp } = await supabaseAdmin
    .from("flashcard_progress")
    .select("study_set_id")
    .eq("user_id", userId)
    .gte("updated_at", sinceIso);
  for (const r of fp ?? []) {
    const sid = (r as { study_set_id?: string }).study_set_id;
    if (sid) setIds.add(sid);
  }

  const { data: qc } = await supabaseAdmin
    .from("quiz_completions")
    .select("study_set_id")
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  for (const r of qc ?? []) {
    const sid = (r as { study_set_id?: string | null }).study_set_id;
    if (sid) setIds.add(sid);
  }

  if (setIds.size === 0) return null;

  const { data: sets } = await supabaseAdmin
    .from("study_sets")
    .select("note_id, note_ids")
    .eq("user_id", userId)
    .in("id", [...setIds]);

  const noteIds = new Set<string>();
  for (const row of sets ?? []) {
    const nid = row.note_id as string | null | undefined;
    if (nid && /^[0-9a-f-]{36}$/i.test(nid)) noteIds.add(nid);
    const raw = row.note_ids;
    if (Array.isArray(raw)) {
      for (const x of raw) {
        if (typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)) noteIds.add(x);
      }
    }
  }

  if (noteIds.size === 0) return null;

  const { data: notes } = await supabaseAdmin
    .from("notes")
    .select("category_id")
    .eq("user_id", userId)
    .in("id", [...noteIds]);

  const catCounts = new Map<string, number>();
  for (const n of notes ?? []) {
    const cid = n.category_id as string | null | undefined;
    if (!cid) continue;
    catCounts.set(cid, (catCounts.get(cid) ?? 0) + 1);
  }

  let bestId: string | null = null;
  let best = 0;
  for (const [cid, c] of catCounts) {
    if (c > best) {
      best = c;
      bestId = cid;
    }
  }
  if (!bestId) return null;

  const { data: cat } = await supabaseAdmin.from("categories").select("name").eq("id", bestId).maybeSingle();
  const name = cat?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/**
 * Users with at least one qualifying study day in the last 7 UTC calendar days (inclusive).
 */
export async function listUserIdsActiveInPastWeek(now: Date = new Date()): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const cutoffYmd = activityCutoffYmd(now);
  const { data, error } = await supabaseAdmin
    .from("user_stats")
    .select("user_id")
    .gte("last_activity_date", cutoffYmd);

  if (error) {
    console.error("[weekly-report] list active users:", error.message);
    return [];
  }
  const ids = (data ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean);
  return [...new Set(ids)];
}

export function motivationalLineForScore(score: number): string {
  if (score >= 9) return "Amazing week! You're on fire 🔥";
  if (score >= 4) return "Good progress this week, keep it up!";
  return "Don't forget to study — your streak is waiting!";
}
