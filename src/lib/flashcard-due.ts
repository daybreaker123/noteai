/** End of current UTC calendar day (inclusive) for “due today” queries. */
export function endOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function isCardDueToday(nextReviewAt: string | Date | null | undefined, endOfToday: Date): boolean {
  if (nextReviewAt == null) return true;
  const t = typeof nextReviewAt === "string" ? new Date(nextReviewAt) : nextReviewAt;
  return !Number.isNaN(t.getTime()) && t.getTime() <= endOfToday.getTime();
}
