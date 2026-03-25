/**
 * SM-2 spaced repetition (SuperMemo 2) for flashcard scheduling.
 * @see https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
 */

export type FlashcardRating = "hard" | "good" | "easy";

const EF_MIN = 1.3;
export const SM2_DEFAULT_EASE = 2.5;

/** Map three-button UI to SM-2 quality (0–5). Hard < 3 triggers reset. */
export function ratingToQuality(rating: FlashcardRating): number {
  switch (rating) {
    case "hard":
      return 2;
    case "good":
      return 4;
    case "easy":
      return 5;
    default:
      return 4;
  }
}

export type Sm2CardState = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
};

/**
 * @param previous - null if the card has never been rated (treated as repetitions 0, default ease).
 * @param quality - SM-2 quality 0–5.
 */
export function computeNextSm2State(previous: Sm2CardState | null, quality: number): Sm2CardState {
  let easeFactor = previous?.easeFactor ?? SM2_DEFAULT_EASE;
  let repetitions = previous?.repetitions ?? 0;
  let intervalDays = previous?.intervalDays ?? 0;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    }
    repetitions += 1;
    easeFactor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    if (easeFactor < EF_MIN) easeFactor = EF_MIN;
  }

  return { easeFactor, intervalDays, repetitions };
}

/** ISO timestamp for when this card should be reviewed again (UTC). */
export function nextReviewAtIso(intervalDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + intervalDays);
  return d.toISOString();
}
