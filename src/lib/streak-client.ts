export type StreakMilestone = 7 | 30 | 100;

export function parseStreakMilestoneFromJson(json: unknown): StreakMilestone | null {
  const o = json as { streak?: { milestone?: unknown } };
  const m = o.streak?.milestone;
  return m === 7 || m === 30 || m === 100 ? m : null;
}
