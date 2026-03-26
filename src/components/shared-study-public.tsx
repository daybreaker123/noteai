"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { StudySetKind } from "@/lib/api-types";
import type { QuizQuestionPublic } from "@/lib/shared-public-types";

type SharedStudyPublicProps = {
  kind: StudySetKind;
  cards: { front: string; back: string }[];
  questions: QuizQuestionPublic[];
};

export function SharedStudyPublic({ kind, cards, questions }: SharedStudyPublicProps) {
  if (kind === "flashcards") {
    return <SharedFlashcardsPublic cards={cards} />;
  }
  return <SharedQuizPublic questions={questions} />;
}

function SharedFlashcardsPublic({ cards }: { cards: { front: string; back: string }[] }) {
  const [i, setI] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const card = cards[i];
  const total = cards.length;

  React.useEffect(() => {
    setFlipped(false);
  }, [i]);

  if (total === 0) {
    return <p className="text-sm text-[var(--muted)]">No flashcards in this set.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Card {i + 1} of {total} · Tap the card to flip
      </p>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-gradient-to-br from-violet-950/40 to-indigo-950/30 px-6 py-8 text-center transition hover:border-purple-500/30"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">
          {flipped ? "Back" : "Front"}
        </span>
        <p className="mt-3 text-lg leading-relaxed text-[var(--text)]">
          {flipped ? card!.back : card!.front}
        </p>
      </button>
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={i === 0}
          onClick={() => setI((x) => Math.max(0, x - 1))}
          className="gap-1 text-[var(--text)]"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setFlipped((f) => !f)}
          className="gap-1 text-[var(--text)]"
        >
          <RotateCcw className="h-4 w-4" />
          Flip
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={i >= total - 1}
          onClick={() => setI((x) => Math.min(total - 1, x + 1))}
          className="gap-1 text-[var(--text)]"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SharedQuizPublic({ questions }: { questions: QuizQuestionPublic[] }) {
  const [i, setI] = React.useState(0);
  const [picked, setPicked] = React.useState<number | null>(null);
  const q = questions[i];
  const total = questions.length;

  React.useEffect(() => {
    setPicked(null);
  }, [i]);

  if (total === 0) {
    return <p className="text-sm text-[var(--muted)]">No quiz questions in this set.</p>;
  }

  const showResult = picked !== null;
  const correct = picked === q!.correctIndex;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Badge className="border-0 bg-cyan-500/20 text-cyan-200">Quiz</Badge>
        <span className="text-sm text-[var(--muted)]">
          Question {i + 1} of {total}
        </span>
      </div>
      <p className="text-lg font-medium leading-snug text-[var(--text)]">{q!.question}</p>
      <ul className="space-y-2">
        {q!.options.map((opt, idx) => {
          const isCorrect = idx === q!.correctIndex;
          const isPicked = idx === picked;
          return (
            <li key={idx}>
              <button
                type="button"
                disabled={showResult}
                onClick={() => setPicked(idx)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left text-sm transition",
                  showResult
                    ? isCorrect
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                      : isPicked
                        ? "border-red-500/40 bg-red-500/10 text-red-100"
                        : "border-[var(--border)] bg-white/[0.03] text-[var(--muted)]"
                    : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] hover:border-purple-500/35 hover:bg-[var(--badge-free-bg)]"
                )}
              >
                {opt}
              </button>
            </li>
          );
        })}
      </ul>
      {showResult ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3">
          <p className={cn("text-sm font-medium", correct ? "text-emerald-300" : "text-amber-200/95")}>
            {correct ? "Correct." : "Not quite — review the correct answer above."}
          </p>
          {q!.explanation ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{q!.explanation}</p>
          ) : null}
          {i < total - 1 ? (
            <Button
              type="button"
              size="sm"
              className="mt-4 border-0 bg-gradient-to-r from-cyan-600 to-blue-600 text-[var(--inverse-text)]"
              onClick={() => setI((x) => x + 1)}
            >
              Next question
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
