"use client";

import * as React from "react";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  type StudyProgressCompletion,
  type StudyProgressStepId,
  STUDY_PROGRESS_LABELS,
  STUDY_PROGRESS_STEP_IDS,
} from "@/lib/note-study-progress";

/** Thin 4-segment bar for note cards. */
export function NoteStudyProgressBar({
  completion,
  className,
}: {
  completion: StudyProgressCompletion;
  className?: string;
}) {
  return (
    <div
      className={cn("flex w-full gap-1", className)}
      role="group"
      aria-label="Study progress"
    >
      {STUDY_PROGRESS_STEP_IDS.map((id) => (
        <div
          key={id}
          title={STUDY_PROGRESS_LABELS[id]}
          className={cn(
            "h-1 min-w-0 flex-1 rounded-full transition-colors duration-300",
            completion[id]
              ? "bg-gradient-to-r from-purple-500/90 to-violet-500/80 shadow-[0_0_8px_-2px_color-mix(in_oklab,var(--accent)_50%,transparent)]"
              : "bg-[var(--input-bg)]"
          )}
        />
      ))}
    </div>
  );
}

type TrailProps = {
  completion: StudyProgressCompletion;
  /** Only incomplete steps are actionable; complete steps show a check. */
  onStepPress?: (step: StudyProgressStepId) => void;
  disabled?: boolean;
  className?: string;
};

/** Clickable breadcrumbs for the note editor header. */
export function NoteStudyProgressTrail({ completion, onStepPress, disabled, className }: TrailProps) {
  return (
    <nav
      aria-label="Study progress"
      className={cn(
        "flex flex-wrap items-center gap-1 border-b border-[var(--sidebar-border)] bg-[var(--chrome-20)] px-3 py-2.5 md:px-4",
        className
      )}
    >
      {STUDY_PROGRESS_STEP_IDS.map((id, i) => {
        const done = completion[id];
        const canPress = !disabled && !done && onStepPress;
        return (
          <React.Fragment key={id}>
            {i > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--faint)]" aria-hidden />
            ) : null}
            <button
              type="button"
              disabled={disabled || done || !onStepPress}
              onClick={() => canPress && onStepPress(id)}
              className={cn(
                "inline-flex min-h-9 min-w-[44px] touch-manipulation items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition sm:min-h-8 sm:min-w-0 sm:text-[13px]",
                done
                  ? "cursor-default text-purple-200/90"
                  : onStepPress
                    ? "text-[var(--muted)] hover:bg-[var(--badge-free-bg)] hover:text-[var(--text)]"
                    : "text-[var(--faint)]"
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400/90" strokeWidth={2.5} aria-hidden />
              ) : null}
              <span>{STUDY_PROGRESS_LABELS[id]}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
