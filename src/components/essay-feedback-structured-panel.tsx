"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  LayoutList,
  Lightbulb,
  Lock,
  PenLine,
  Sparkles,
  SpellCheck2,
  Target,
  type LucideIcon,
} from "lucide-react";
import { TutorMarkdown } from "@/components/tutor-markdown";
import type { EssayFeedbackRating, EssayFeedbackStructured } from "@/lib/essay-feedback-types";
import { cn } from "@/lib/cn";

const SECTION_ICONS: Record<string, LucideIcon> = {
  overall: Sparkles,
  thesis: Target,
  structure: LayoutList,
  evidence: BookOpen,
  style: PenLine,
  grammar: SpellCheck2,
  suggestions: Lightbulb,
};

function ratingBadgeClass(rating: EssayFeedbackRating): string {
  switch (rating) {
    case "Strong":
      return "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]";
    case "Needs Work":
      return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]";
    default:
      return "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-fg)]";
  }
}

const BLUR_PLACEHOLDER_LINES = [
  "In-depth commentary on how clearly your main claim is stated, whether it responds to the prompt, and how effectively each paragraph advances that argument.",
  "Feedback on logical flow between ideas, paragraph order, transitions, and whether your introduction and conclusion frame the essay effectively.",
  "Analysis of how well examples and evidence support your points, and suggestions for strengthening reasoning or adding support where needed.",
  "Notes on sentence variety, word choice, tone, and clarity — tailored to your grade level and essay type.",
];

function LockedSectionPreview() {
  const text = BLUR_PLACEHOLDER_LINES.join(" ");
  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)]">
      <div
        className="pointer-events-none select-none px-4 py-3.5 text-sm leading-relaxed text-[var(--muted)]"
        style={{ filter: "blur(5px)" }}
        aria-hidden
      >
        {text}
      </div>
      <div className="studara-overlay-scan absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-4 backdrop-blur-[2px]">
        <span className="flex items-center gap-1.5 rounded-full border border-[var(--pro-badge-border)] bg-[var(--pro-badge-bg)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--pro-badge-fg)]">
          <Lock className="h-3 w-3" strokeWidth={2.5} />
          Pro
        </span>
        <Link
          href="/billing"
          className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] transition hover:from-violet-500 hover:to-purple-500"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}

function GradeLockedHeader() {
  return (
    <div className="relative shrink-0 overflow-hidden border-b border-[var(--sidebar-border)] p-5 sm:p-6">
      <div className="pointer-events-none select-none opacity-40" style={{ filter: "blur(8px)" }} aria-hidden>
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--faint)]">
          Estimated grade
        </p>
        <p className="mt-2 text-center text-5xl font-bold text-[var(--text)]">B+</p>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-[var(--muted)]">
          Your essay demonstrates solid understanding with room to refine structure and evidence. A detailed
          rationale appears with Pro.
        </p>
      </div>
      <div className="studara-overlay-75 absolute inset-0 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
        <Lock className="h-6 w-6 text-[var(--accent-fg)]" strokeWidth={1.75} />
        <p className="text-center text-sm font-medium text-[var(--text)]">Grade estimate is a Pro feature</p>
        <Link
          href="/billing"
          className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-lg)] transition hover:from-violet-500 hover:to-purple-500"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}

function FeedbackSection({
  section,
  defaultOpen,
}: {
  section: EssayFeedbackStructured["sections"][number];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const Icon = SECTION_ICONS[section.id] ?? Sparkles;
  const locked = Boolean(section.locked);

  return (
    <div className="border-b border-[var(--sidebar-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 py-3.5 text-left transition hover:bg-[var(--surface-ghost-hover)]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--accent-fg)]">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--text)]">{section.title}</span>
        {locked ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--badge-free-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
            <Lock className="h-3 w-3" strokeWidth={2.5} />
            Locked
          </span>
        ) : (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
              ratingBadgeClass(section.rating)
            )}
          >
            {section.rating}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--placeholder)] transition-transform duration-200",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      {open ? (
        locked ? (
          <div className="border-t border-[var(--border-subtle)] px-3 py-3 pl-[3.25rem]">
            <LockedSectionPreview />
          </div>
        ) : (
          <div className="essay-feedback-markdown border-t border-[var(--border-subtle)] bg-[var(--chrome-20)] px-3 py-4 pl-[3.25rem] text-sm leading-relaxed text-[var(--text)]">
            <TutorMarkdown content={section.body} />
          </div>
        )
      ) : null}
    </div>
  );
}

export function EssayFeedbackStructuredPanel({ data }: { data: EssayFeedbackStructured }) {
  const gradeLocked = Boolean(data.gradeLocked);
  const firstUnlockedIdx = data.sections.findIndex((s) => !s.locked);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--modal-surface)] shadow-[inset_0_0_0_1px_var(--ring-inset-panel)]">
      {gradeLocked ? (
        <GradeLockedHeader />
      ) : (
        <div className="shrink-0 border-b border-[var(--sidebar-border)] bg-gradient-to-br from-[var(--structured-grade-header-from)] via-[var(--bg-subtle)] to-[var(--structured-grade-header-to)] p-5 sm:p-6">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--faint)]">
            Estimated grade
          </p>
          <p className="mt-2 text-center text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
            {data.gradeBadge}
          </p>
          <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-[var(--muted)]">
            {data.gradeBlurb}
          </p>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:[display:none]">
        {data.sections.map((section, i) => (
          <FeedbackSection
            key={section.id}
            section={section}
            defaultOpen={firstUnlockedIdx === -1 ? i === 0 : i === firstUnlockedIdx}
          />
        ))}
      </div>
    </div>
  );
}
