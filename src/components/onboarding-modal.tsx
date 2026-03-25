"use client";

import * as React from "react";
import {
  BookOpen,
  GraduationCap,
  HelpCircle,
  PenLine,
  Sparkles,
  SquareStack,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { StudaraWordmark } from "@/components/studara-wordmark";
import { Button } from "@/components/ui";

const STEP_COUNT = 4;

type OnboardingModalProps = {
  open: boolean;
  onFinished: (payload: { welcomeNoteId: string | null }) => void | Promise<void>;
};

export function OnboardingModal({ open, onFinished }: OnboardingModalProps) {
  const [step, setStep] = React.useState(0);
  const [finishing, setFinishing] = React.useState(false);

  React.useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    let welcomeNoteId: string | null = null;
    try {
      const res = await fetch("/api/me/onboarding", { method: "POST", credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as { welcomeNoteId?: string | null };
      if (!res.ok) {
        console.error("[onboarding] complete failed", await res.text().catch(() => ""));
      }
      welcomeNoteId = typeof j.welcomeNoteId === "string" ? j.welcomeNoteId : null;
    } catch (e) {
      console.error(e);
    } finally {
      setFinishing(false);
      await onFinished({ welcomeNoteId });
    }
  }

  function skip() {
    void finish();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[#06060a] text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[min(520px,80vw)] w-[min(900px,140%)] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/25 via-violet-500/15 to-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[min(400px,60vh)] w-[min(700px,100%)] rounded-full bg-gradient-to-tl from-indigo-600/12 via-purple-600/10 to-transparent blur-3xl" />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step ? "w-8 bg-gradient-to-r from-purple-400 to-violet-400" : "w-1.5 bg-white/20",
                  i < step && "bg-purple-500/50"
                )}
                aria-hidden
              />
            ))}
          </div>
          <button
            type="button"
            onClick={skip}
            disabled={finishing}
            className="flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80 touch-manipulation disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden />
            Skip
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-6 pt-2 sm:px-10 sm:pb-10">
          {step === 0 && <StepWelcome />}
          {step === 1 && <StepEditor />}
          {step === 2 && <StepAi />}
          {step === 3 && <StepStudy />}
        </div>

        <footer className="shrink-0 border-t border-white/[0.08] bg-black/30 px-4 py-4 backdrop-blur-xl sm:px-8">
          <div className="mx-auto flex max-w-lg flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={skip}
              disabled={finishing}
              className="order-2 min-h-12 border border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/10 sm:order-1 sm:min-w-[7rem]"
            >
              Skip
            </Button>
            {step < STEP_COUNT - 1 ? (
              <button
                type="button"
                disabled={finishing}
                onClick={() => setStep((s) => Math.min(STEP_COUNT - 1, s + 1))}
                className="order-1 flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 px-6 text-base font-semibold text-white shadow-lg shadow-purple-900/35 transition hover:from-purple-400 hover:to-violet-500 disabled:opacity-50 sm:order-2 sm:w-auto sm:min-w-[10rem] touch-manipulation"
              >
                {step === 0 ? "Start" : "Next"}
              </button>
            ) : (
              <button
                type="button"
                disabled={finishing}
                onClick={() => void finish()}
                className="order-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 px-6 text-base font-semibold text-white shadow-lg shadow-purple-900/35 transition hover:from-purple-400 hover:to-violet-500 disabled:opacity-50 sm:order-2 sm:w-auto sm:min-w-[10rem] touch-manipulation"
              >
                {finishing ? "Setting up…" : "Get started"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function StepWelcome() {
  return (
    <div className="flex max-w-md flex-col items-center text-center">
      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-violet-600/10 p-6 shadow-[0_0_48px_-12px_rgba(139,92,246,0.45)]">
          <StudaraWordmark className="text-4xl sm:text-5xl" />
        </div>
      </div>
      <h1 id="onboarding-title" className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Welcome to Studara
      </h1>
      <p className="mt-4 text-base leading-relaxed text-white/60 sm:text-lg">
        Notes, AI study tools, and tutoring — built for how you actually learn.
      </p>
    </div>
  );
}

function StepEditor() {
  return (
    <div className="flex w-full max-w-lg flex-col items-center sm:max-w-2xl">
      <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">Create your first note</h2>
      <p className="mt-3 max-w-xl text-center text-sm leading-relaxed text-white/55 sm:text-base">
        The editor supports rich text — headings, lists, quotes, code, images, tables, and checklists. Everything
        saves automatically as you type.
      </p>
      <div
        className="mt-8 w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c12]/90 p-[1px] shadow-2xl shadow-purple-950/40"
        aria-hidden
      >
        <div className="rounded-[15px] bg-gradient-to-br from-purple-500/20 via-transparent to-violet-500/10 p-4">
          <div className="mb-3 flex gap-1 rounded-lg border border-white/10 bg-black/40 px-2 py-2">
            <span className="h-8 w-8 rounded-md bg-white/10" />
            <span className="h-8 w-8 rounded-md bg-white/10" />
            <span className="h-8 w-8 rounded-md bg-purple-500/30 ring-1 ring-purple-400/40" />
            <span className="h-8 w-8 rounded-md bg-white/10" />
            <span className="ml-auto h-8 w-20 rounded-md bg-white/5" />
          </div>
          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/50 px-4 py-4 text-left">
            <div className="h-3 w-[60%] max-w-[12rem] rounded bg-white/25" />
            <div className="h-2 w-full rounded bg-white/10" />
            <div className="h-2 w-[92%] rounded bg-white/10" />
            <div className="mt-3 flex gap-2">
              <div className="h-2 w-24 rounded bg-violet-500/35" />
              <div className="h-2 w-16 rounded bg-white/10" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <PenLine className="h-4 w-4 text-purple-300/80" />
              <span className="text-xs text-white/35">Toolbar · formatting &amp; inserts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/25 to-violet-600/15 ring-1 ring-purple-500/20">
        <Icon className="h-6 w-6 text-purple-200" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 text-left">
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-white/55">{children}</p>
      </div>
    </div>
  );
}

function StepAi() {
  return (
    <div className="w-full max-w-md space-y-4 sm:max-w-lg">
      <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">Let AI do the heavy lifting</h2>
      <p className="mb-6 text-center text-sm text-white/50">
        From any open note, use the editor toolbar to go faster.
      </p>
      <FeatureRow icon={Wand2} title="Improve">
        Rewrites and expands your notes while keeping structure — great for clarity before an exam.
      </FeatureRow>
      <FeatureRow icon={Sparkles} title="Summarize">
        Get a tight overview of long notes without leaving the page.
      </FeatureRow>
      <FeatureRow icon={BookOpen} title="Study">
        Turn this note into flashcards or a quiz in one click.
      </FeatureRow>
    </div>
  );
}

function StepStudy() {
  return (
    <div className="w-full max-w-md space-y-4 sm:max-w-lg">
      <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">Study smarter</h2>
      <p className="mb-6 text-center text-sm text-white/50">Practice and help — beyond your notes grid.</p>
      <FeatureRow icon={SquareStack} title="Flashcards">
        Flip through terms and answers at your own pace; save sets to revisit later.
      </FeatureRow>
      <FeatureRow icon={HelpCircle} title="Quizzes">
        Multiple choice with feedback so you know what to review.
      </FeatureRow>
      <FeatureRow icon={GraduationCap} title="AI Tutor">
        Ask questions, share images or documents, and optionally pull in your saved notes as context.
      </FeatureRow>
    </div>
  );
}
