"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, FilePenLine, Loader2, Sparkles } from "lucide-react";
import { EssayAnnotatedEditor } from "@/components/essay-annotated-editor";
import { EssayFeedbackStructuredPanel } from "@/components/essay-feedback-structured-panel";
import { TutorMarkdown } from "@/components/tutor-markdown";
import type { EssayAnnotation } from "@/lib/essay-annotation-types";
import { ESSAY_TYPE_OPTIONS, GRADE_LEVEL_OPTIONS } from "@/lib/essay-feedback-options";
import {
  parseEssayFeedbackJson,
  type EssayFeedbackStructured,
} from "@/lib/essay-feedback-types";
import { cn } from "@/lib/cn";
import { captureAnalytics } from "@/lib/analytics";

const headerSelectClass =
  "min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--hover-bg-subtle)] py-2 pl-2.5 pr-7 text-base font-medium text-[var(--text)] outline-none transition focus:border-[var(--focus-border-color)] focus:ring-2 focus:ring-[var(--focus-ring-color)] sm:min-h-10 sm:min-w-[8.5rem] sm:flex-none sm:pl-3 sm:text-xs md:min-w-[9.5rem] md:text-sm";

function wordCount(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function EssayFeedbackPage() {
  const { status } = useSession();
  const [essay, setEssay] = React.useState("");
  const [essayType, setEssayType] = React.useState<string>(ESSAY_TYPE_OPTIONS[0]!.value);
  const [gradeLevel, setGradeLevel] = React.useState<string>(
    GRADE_LEVEL_OPTIONS.find((o) => o.value === "high school")!.value
  );
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [feedbackStructured, setFeedbackStructured] = React.useState<EssayFeedbackStructured | null>(
    null
  );
  const [annotations, setAnnotations] = React.useState<EssayAnnotation[]>([]);
  const annotationsRef = React.useRef<EssayAnnotation[]>([]);
  React.useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  const [highlightsClearedNotice, setHighlightsClearedNotice] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [plan, setPlan] = React.useState<"free" | "pro" | null>(null);

  const structured = React.useMemo(
    () => feedbackStructured ?? (feedback ? parseEssayFeedbackJson(feedback) : null),
    [feedbackStructured, feedback]
  );

  const hasResults = Boolean(feedback) && !loading;
  const chars = essay.length;
  const words = wordCount(essay);

  const refreshUsage = React.useCallback(async () => {
    try {
      const res = await fetch("/api/ai/anthropic/essay-feedback", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        plan?: string;
        essayFeedbackRemaining?: number | null;
      };
      setPlan(json.plan === "pro" ? "pro" : "free");
      if (json.essayFeedbackRemaining != null) {
        setRemaining(json.essayFeedbackRemaining);
      } else {
        setRemaining(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (status === "authenticated") void refreshUsage();
  }, [status, refreshUsage]);

  const handleBeginEssayEdit = React.useCallback(() => {
    if (annotationsRef.current.length === 0) return;
    setAnnotations([]);
    setHighlightsClearedNotice(true);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = essay.trim();
    if (!text || loading) return;
    setError(null);
    setLoading(true);
    setFeedback(null);
    setFeedbackStructured(null);
    setAnnotations([]);
    setHighlightsClearedNotice(false);
    try {
      const res = await fetch("/api/ai/anthropic/essay-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essay: text,
          essayType,
          gradeLevel,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        feedback?: string;
        feedbackStructured?: EssayFeedbackStructured | null;
        annotations?: EssayAnnotation[];
        plan?: string;
        error?: string;
        code?: string;
        essayFeedbackRemaining?: number | null;
      };
      if (res.status === 402 && json.code === "FREE_LIMIT_ESSAY_FEEDBACK") {
        setError(
          json.error ??
            "You've used all 3 free basic feedbacks this month. Upgrade to Pro for unlimited advanced feedback."
        );
        setRemaining(0);
        return;
      }
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Try again.");
        return;
      }
      captureAnalytics("essay_feedback_requested", { essay_type: essayType, grade_level: gradeLevel });
      if (json.plan === "pro" || json.plan === "free") {
        setPlan(json.plan);
      }
      setFeedback(typeof json.feedback === "string" ? json.feedback : null);
      setFeedbackStructured(
        json.feedbackStructured && typeof json.feedbackStructured === "object"
          ? json.feedbackStructured
          : null
      );
      if (Array.isArray(json.annotations)) {
        setAnnotations(json.annotations);
      } else {
        setAnnotations([]);
      }
      if (json.essayFeedbackRemaining != null) {
        setRemaining(json.essayFeedbackRemaining);
      } else {
        setRemaining(null);
        setPlan("pro");
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--faint)]" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const essayCard = (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] shadow-[inset_0_1px_0_var(--inset-shine)]",
        hasResults ? "min-h-[200px] flex-1 lg:min-h-0" : "min-h-[min(420px,calc(100dvh-280px))] flex-1"
      )}
    >
      {hasResults ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 border-b border-[var(--sidebar-border)] px-4 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Your essay</span>
          {annotations.length > 0 ? (
            <span className="text-[10px] text-[var(--placeholder)]">
              <span className="text-[var(--annotation-legend-red)]">Red</span> ·{" "}
              <span className="text-[var(--annotation-legend-yellow)]">Yellow</span> ·{" "}
              <span className="text-[var(--annotation-legend-blue)]">Blue</span> ·{" "}
              <span className="text-[var(--annotation-legend-orange)]">Orange</span> — click to edit (clears highlights)
            </span>
          ) : null}
        </div>
      ) : null}
      <EssayAnnotatedEditor
        value={essay}
        onChange={setEssay}
        annotations={annotations}
        onBeginEdit={handleBeginEssayEdit}
        disabled={loading}
        loading={loading}
        embedded
        footerSlot={
          <span>
            {chars.toLocaleString()} chars · {words.toLocaleString()} words
          </span>
        }
        className="min-h-0 flex-1"
      />
    </div>
  );

  const submitButton = (
    <button
      type="submit"
      disabled={loading || !essay.trim() || (plan === "free" && remaining === 0)}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 py-4 text-base font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-lg)] transition hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40"
      )}
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Analyzing essay…
        </>
      ) : (
        <>
          <Sparkles className="h-5 w-5 text-[var(--btn-primary-sparkle)]" strokeWidth={2} />
          Get Feedback
        </>
      )}
    </button>
  );

  return (
    <div className="flex min-h-dvh max-w-[100vw] flex-col overflow-x-hidden bg-[var(--bg)] text-[var(--text)] lg:h-dvh lg:max-h-dvh lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-32 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background: `linear-gradient(to right, var(--page-glow-from), var(--page-glow-via), var(--page-glow-to))`,
          }}
        />
        <div
          className="absolute bottom-0 right-0 h-[320px] w-[480px] rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, var(--page-glow-corner), transparent 70%)` }}
        />
      </div>

      <header className="relative z-20 shrink-0 border-b border-[var(--sidebar-border)] bg-[var(--header-bar)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-4 sm:gap-4 sm:px-8 sm:py-5">
          <Link
            href="/notes"
            className="flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl px-3 py-2 text-base text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] sm:min-h-0 sm:px-2 sm:text-sm"
          >
            <ArrowLeft className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
            Notes
          </Link>
          <div className="hidden h-8 w-px bg-[var(--input-bg)] sm:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] shadow-inner"
              style={{
                background: `linear-gradient(to bottom right, var(--header-icon-surface-from), var(--header-icon-surface-to))`,
              }}
            >
              <FilePenLine className="h-5 w-5 text-[var(--accent-icon)]" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">Essay feedback</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">AI-powered draft review</p>
            </div>
          </div>
          {plan === "free" && remaining !== null ? (
            <span
              className="ml-auto shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]"
              title="3 free basic feedbacks per month"
            >
              {remaining} free left this month
            </span>
          ) : plan === "pro" ? (
            <span className="ml-auto shrink-0 rounded-full border border-[var(--pro-badge-border)] bg-[var(--pro-badge-bg)] px-3 py-1.5 text-xs font-medium text-[var(--pro-badge-fg)]">
              Pro · unlimited
            </span>
          ) : null}
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {!hasResults ? (
          <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-8 sm:py-10 lg:flex-row lg:gap-10">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <label className="sr-only" htmlFor="essay-type-select">
                  Essay type
                </label>
                <select
                  id="essay-type-select"
                  className={headerSelectClass}
                  value={essayType}
                  onChange={(e) => setEssayType(e.target.value)}
                  disabled={loading}
                >
                  {ESSAY_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[var(--surface-mid)] text-[var(--text)]">
                      {o.label}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="grade-level-select">
                  Grade level
                </label>
                <select
                  id="grade-level-select"
                  className={headerSelectClass}
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  disabled={loading}
                >
                  {GRADE_LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[var(--surface-mid)] text-[var(--text)]">
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {essayCard}
              {submitButton}
            {highlightsClearedNotice ? (
              <p className="text-center text-xs leading-relaxed text-[var(--faint)]">
                Highlights cleared — edit your essay and click Get Feedback again for updated analysis.
              </p>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-fg)]">
                {error}
                {error.includes("upgrade") || error.includes("Pro") ? (
                  <Link
                    href="/billing"
                    className="ml-2 font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    View plans
                  </Link>
                ) : null}
              </div>
            ) : null}
            </div>
            <aside className="hidden w-full max-w-sm shrink-0 lg:block">
              <div className="rounded-2xl border border-[var(--sidebar-border)] bg-[var(--surface-ghost)] p-6 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--faint)]">Tips</p>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--muted)]">
                  <li>Choose essay type and grade level so feedback matches your assignment.</li>
                  <li>Pro unlocks grade estimates, full rubric sections, and inline highlights.</li>
                  <li>Free includes three basic feedbacks per month on key areas.</li>
                </ul>
              </div>
            </aside>
            <div className="rounded-2xl border border-[var(--sidebar-border)] bg-[var(--surface-ghost)] p-5 backdrop-blur-sm lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--faint)]">Tips</p>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-[var(--muted)]">
                <li>Choose essay type and grade level so feedback matches your assignment.</li>
                <li>Pro unlocks grade estimates, full rubric sections, and inline highlights.</li>
                <li>Free includes three basic feedbacks per month on key areas.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-hidden px-4 py-6 sm:px-8 sm:py-8">
            {error ? (
              <div className="mb-4 shrink-0 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-fg)]">
                {error}
                {error.includes("upgrade") || error.includes("Pro") ? (
                  <Link
                    href="/billing"
                    className="ml-2 font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    View plans
                  </Link>
                ) : null}
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row lg:gap-10">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:basis-0 lg:max-w-[52%]">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <label className="sr-only" htmlFor="essay-type-select-results">
                    Essay type
                  </label>
                  <select
                    id="essay-type-select-results"
                    className={headerSelectClass}
                    value={essayType}
                    onChange={(e) => setEssayType(e.target.value)}
                    disabled={loading}
                  >
                    {ESSAY_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[var(--surface-mid)] text-[var(--text)]">
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="grade-level-select-results">
                    Grade level
                  </label>
                  <select
                    id="grade-level-select-results"
                    className={headerSelectClass}
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    disabled={loading}
                  >
                    {GRADE_LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[var(--surface-mid)] text-[var(--text)]">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {essayCard}
                {highlightsClearedNotice ? (
                  <p className="shrink-0 text-xs leading-relaxed text-[var(--faint)]">
                    Highlights cleared — edit your essay and click Get Feedback again for updated analysis.
                  </p>
                ) : null}
                {submitButton}
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:basis-0">
                <div className="flex shrink-0 flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
                    Feedback
                  </span>
                  {plan === "free" ? (
                    <p className="text-[11px] text-[var(--placeholder)]">
                      Basic feedback — upgrade for grade estimate, highlights, and all sections.
                    </p>
                  ) : null}
                </div>
                {structured ? (
                  <EssayFeedbackStructuredPanel data={structured} />
                ) : feedback ? (
                  <div className="essay-feedback-markdown min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--modal-surface)] p-5 text-sm text-[var(--text)] [scrollbar-width:none] [&::-webkit-scrollbar]:[display:none]">
                    <TutorMarkdown content={feedback} />
                  </div>
                ) : (
                  <p className="text-sm text-[var(--faint)]">No feedback payload returned. Try again.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
