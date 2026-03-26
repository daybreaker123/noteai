"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, SquareStack, MessageCircle, Flame } from "lucide-react";
import { StudaraWordmark } from "@/components/studara-wordmark";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  ONBOARDING_PERSONAS,
  ONBOARDING_PERSONA_LABELS,
  type OnboardingPersona,
} from "@/lib/onboarding-persona";

const STEP_COUNT = 6;

function CoachMark({
  anchorRef,
  children,
  align = "start",
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  align?: "start" | "center";
}) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = el.getBoundingClientRect();
      setPos({
        top: r.bottom + 10,
        left: align === "center" ? r.left + r.width / 2 : r.left,
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchorRef, align]);

  if (pos === null || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed z-[220] w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-purple-500/45 bg-[#12121a]/98 px-4 py-3 text-sm leading-relaxed text-white/95 shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur-md",
        align === "center" && "-translate-x-1/2"
      )}
      style={{ top: pos.top, left: pos.left }}
      role="status"
    >
      {children}
    </div>,
    document.body
  );
}

function BottomCoachMark({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="pointer-events-none fixed bottom-[5.5rem] left-1/2 z-[220] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border border-purple-500/45 bg-[#12121a]/98 px-4 py-3 text-center text-sm leading-relaxed text-white/95 shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur-md"
      role="status"
    >
      {children}
    </div>,
    document.body
  );
}

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Step ${step} of ${STEP_COUNT}`}>
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            i + 1 === step ? "w-8 bg-gradient-to-r from-purple-400 to-violet-400" : "w-2 bg-white/20",
            i + 1 < step && "bg-purple-500/55"
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}

function OnboardingChrome({
  step,
  onSkip,
  skipDisabled,
}: {
  step: number;
  onSkip: () => void;
  skipDisabled?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[210] border-t border-white/[0.08] bg-[#06060a]/92 px-4 py-3 backdrop-blur-xl sm:py-4">
      <div className="mx-auto flex max-w-3xl flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ProgressDots step={step} />
        <button
          type="button"
          onClick={onSkip}
          disabled={skipDisabled}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white/85 touch-manipulation disabled:opacity-40 sm:min-h-0 sm:justify-end"
        >
          <X className="h-4 w-4" aria-hidden />
          Skip setup
        </button>
      </div>
    </div>
  );
}

export type GuidedOnboardingProps = {
  step: number;
  persona: OnboardingPersona | null;
  onPersonaChange: (p: OnboardingPersona) => void;
  onWelcomeContinue: () => void;
  welcomeLoading: boolean;
  onSkip: () => void;
  skipDisabled?: boolean;
  onFinishDashboard: () => void;
  onTutorContinue: () => void;
  finishLoading?: boolean;
  improveButtonRef: React.RefObject<HTMLElement | null>;
  showImproveCoach: boolean;
  showMagicCoach: boolean;
  showFlashcardCoach: boolean;
  showTutorCoach: boolean;
  currentStreak: number;
};

export function GuidedOnboarding({
  step,
  persona,
  onPersonaChange,
  onWelcomeContinue,
  welcomeLoading,
  onSkip,
  skipDisabled,
  onFinishDashboard,
  onTutorContinue,
  finishLoading,
  improveButtonRef,
  showImproveCoach,
  showMagicCoach,
  showFlashcardCoach,
  showTutorCoach,
  currentStreak,
}: GuidedOnboardingProps) {
  const fullScreen = step === 1 || step === 5 || step === 6;

  React.useEffect(() => {
    if (!fullScreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullScreen]);

  return (
    <>
      <AnimatePresence>
        {fullScreen && (
          <motion.div
            key="full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col bg-[#06060a] text-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guided-onboarding-title"
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-32 left-1/2 h-[min(520px,80vw)] w-[min(900px,140%)] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/25 via-violet-500/15 to-fuchsia-500/20 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-[min(400px,60vh)] w-[min(700px,100%)] rounded-full bg-gradient-to-tl from-indigo-600/12 via-purple-600/10 to-transparent blur-3xl" />
            </div>

            <header className="relative flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-8">
              <ProgressDots step={step} />
              <button
                type="button"
                onClick={onSkip}
                disabled={skipDisabled}
                className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80 touch-manipulation disabled:opacity-40"
              >
                <X className="h-4 w-4" aria-hidden />
                Skip
              </button>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-28 pt-4 sm:px-10 sm:pb-32 sm:pt-6">
              {step === 1 && (
                <div className="flex w-full max-w-lg flex-col items-center text-center">
                  <div className="mb-6 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-violet-600/10 p-6 shadow-[0_0_48px_-12px_rgba(139,92,246,0.45)]">
                    <StudaraWordmark className="text-4xl sm:text-5xl" />
                  </div>
                  <h1 id="guided-onboarding-title" className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Welcome to Studara
                  </h1>
                  <p className="mt-3 text-base text-white/55 sm:text-lg">Let&apos;s get you set up in 2 minutes</p>

                  <p className="mt-10 text-sm font-medium text-white/45">What best describes you?</p>
                  <div className="mt-4 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                    {ONBOARDING_PERSONAS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onPersonaChange(p)}
                        className={cn(
                          "min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-medium transition touch-manipulation",
                          persona === p
                            ? "border-purple-500/60 bg-purple-500/20 text-white ring-2 ring-purple-500/35"
                            : "border-white/10 bg-white/[0.04] text-white/80 hover:border-white/20 hover:bg-white/[0.07]"
                        )}
                      >
                        {ONBOARDING_PERSONA_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="flex w-full max-w-lg flex-col items-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-violet-600/25 ring-1 ring-white/10">
                    <MessageCircle className="h-7 w-7 text-cyan-200" strokeWidth={1.75} />
                  </div>
                  <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">Meet your AI Tutor</h2>
                  <p className="mt-2 text-center text-sm text-white/50">
                    Ask questions anytime — here&apos;s a quick example of how a reply might look.
                  </p>
                  <div className="mt-8 w-full space-y-3 rounded-2xl border border-white/10 bg-black/35 p-4 text-left shadow-inner sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">You</p>
                    <p className="text-sm text-white/85">
                      Can you explain the difference between mitosis and meiosis in simple terms?
                    </p>
                    <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-cyan-300/90">Tutor</p>
                    <p className="text-sm leading-relaxed text-white/75">
                      Mitosis is one cell dividing into two identical daughter cells — used for growth and repair. Meiosis
                      produces four cells with half the chromosomes, which is how we make eggs and sperm for sexual
                      reproduction. If you tell me your class level, I can give you a memory trick that matches how your
                      professor grades.
                    </p>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="flex w-full max-w-md flex-col items-center text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/35 to-violet-600/25 ring-1 ring-white/10">
                    <Sparkles className="h-8 w-8 text-emerald-200" strokeWidth={1.75} />
                  </div>
                  <h2 className="text-xl font-semibold text-white sm:text-2xl">You&apos;re all set</h2>
                  <p className="mt-2 text-sm text-white/50">Here&apos;s what you just unlocked:</p>
                  <ul className="mt-6 w-full space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 text-left text-sm text-white/80">
                    <li className="flex gap-3">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" />
                      <span>Improved a real note with AI — clearer structure and richer explanations.</span>
                    </li>
                    <li className="flex gap-3">
                      <SquareStack className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                      <span>Generated flashcards from your note in seconds.</span>
                    </li>
                    <li className="flex gap-3">
                      <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                      <span>Met your AI Tutor — ready 24/7 when you&apos;re stuck.</span>
                    </li>
                  </ul>
                  <div className="mt-8 flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
                    <Flame className="h-5 w-5 shrink-0 text-orange-300" aria-hidden />
                    <span>
                      Current streak: <strong className="text-white">Day {Math.max(1, currentStreak)}</strong> — keep it
                      going tomorrow!
                    </span>
                  </div>
                </div>
              )}
            </div>

            <footer className="relative shrink-0 border-t border-white/[0.08] bg-black/40 px-4 py-4 backdrop-blur-xl sm:px-8">
              <div className="mx-auto flex max-w-lg flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onSkip}
                  disabled={skipDisabled}
                  className="order-2 min-h-12 border border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/10 sm:order-1"
                >
                  Skip
                </Button>
                {step === 1 && (
                  <button
                    type="button"
                    disabled={!persona || welcomeLoading || skipDisabled}
                    onClick={onWelcomeContinue}
                    className="order-1 min-h-12 w-full rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 px-6 text-base font-semibold text-white shadow-lg shadow-purple-900/35 transition hover:from-purple-400 hover:to-violet-500 disabled:opacity-50 sm:order-2 sm:w-auto touch-manipulation"
                  >
                    {welcomeLoading ? "Creating your note…" : "Get started"}
                  </button>
                )}
                {step === 5 && (
                  <button
                    type="button"
                    onClick={onTutorContinue}
                    className="order-1 min-h-12 w-full rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 px-6 text-base font-semibold text-white shadow-lg shadow-purple-900/35 sm:order-2 sm:w-auto touch-manipulation"
                  >
                    Continue
                  </button>
                )}
                {step === 6 && (
                  <button
                    type="button"
                    disabled={finishLoading || skipDisabled}
                    onClick={onFinishDashboard}
                    className="order-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 px-6 text-base font-semibold text-white shadow-lg shadow-purple-900/35 disabled:opacity-50 sm:order-2 sm:w-auto touch-manipulation"
                  >
                    {finishLoading ? "Saving…" : "Start studying"}
                  </button>
                )}
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {step >= 2 && step <= 4 && (
        <>
          <OnboardingChrome step={step} onSkip={onSkip} skipDisabled={skipDisabled} />
          {showImproveCoach && <CoachMark anchorRef={improveButtonRef}>Try improving this note with AI.</CoachMark>}
          {showMagicCoach && (
            <BottomCoachMark>
              Your notes just got smarter. Now let&apos;s turn them into study material.
            </BottomCoachMark>
          )}
          {showFlashcardCoach && (
            <BottomCoachMark>
              Flashcards generated in seconds. Click any card to flip it.
            </BottomCoachMark>
          )}
        </>
      )}

      {step === 5 && showTutorCoach && (
        <BottomCoachMark>Your 24/7 tutor is ready whenever you need it.</BottomCoachMark>
      )}
    </>
  );
}
