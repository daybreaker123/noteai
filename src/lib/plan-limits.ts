/** Free-tier limits (must match API routes and `useNotesRemote`). */
export const FREE_NOTE_TOTAL = 50;
export const FREE_SUMMARY_PER_MONTH = 10;
export const FREE_IMPROVE_PER_MONTH = 5;
export const FREE_TUTOR_MESSAGES_PER_MONTH = 20;
export const FREE_TUTOR_IMAGES_PER_MONTH = 5;

export type PlanLimits = {
  notesTotal: number | null;
  summarizationsPerMonth: number | null;
  improvementsPerMonth: number | null;
  tutorMessagesPerMonth: number | null;
  tutorImagesPerMonth: number | null;
};

export function limitsForPlan(plan: "free" | "pro"): PlanLimits {
  if (plan === "pro") {
    return {
      notesTotal: null,
      summarizationsPerMonth: null,
      improvementsPerMonth: null,
      tutorMessagesPerMonth: null,
      tutorImagesPerMonth: null,
    };
  }
  return {
    notesTotal: FREE_NOTE_TOTAL,
    summarizationsPerMonth: FREE_SUMMARY_PER_MONTH,
    improvementsPerMonth: FREE_IMPROVE_PER_MONTH,
    tutorMessagesPerMonth: FREE_TUTOR_MESSAGES_PER_MONTH,
    tutorImagesPerMonth: FREE_TUTOR_IMAGES_PER_MONTH,
  };
}
