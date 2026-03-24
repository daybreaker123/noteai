"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import {
  usePomodoro,
  POMODORO_DURATIONS,
  type PomodoroMode,
} from "@/components/pomodoro/pomodoro-context";
import { cn } from "@/lib/cn";

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ringColor(mode: PomodoroMode): string {
  switch (mode) {
    case "focus":
      return "stroke-purple-400";
    case "shortBreak":
      return "stroke-emerald-400";
    case "longBreak":
      return "stroke-sky-400";
    default:
      return "stroke-purple-400";
  }
}

const gradientBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-purple-950/30 transition hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40 sm:text-sm";

function PomodoroExpanded() {
  const {
    mode,
    secondsRemaining,
    isRunning,
    focusCompletedInCycle,
    setMode,
    closeWidget,
    play,
    pause,
    reset,
  } = usePomodoro();

  const total = POMODORO_DURATIONS[mode];
  const progress = total > 0 ? secondsRemaining / total : 0;
  const offset = RING_C * (1 - progress);

  const sessionLine =
    mode === "focus"
      ? focusCompletedInCycle >= 4
        ? "Cycle complete — take a long break"
        : `Session ${focusCompletedInCycle + 1} of 4`
      : mode === "shortBreak"
        ? "Short break"
        : "Long break";

  return (
    <div
      className="fixed bottom-5 right-5 z-[92] w-[min(calc(100vw-2rem),20rem)] rounded-2xl border border-white/[0.1] bg-[#0e0e14]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
      role="dialog"
      aria-label="Pomodoro timer"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white/80">
          <Timer className="h-4 w-4 text-purple-300" />
          <span className="text-sm font-semibold">Pomodoro</span>
        </div>
        <button
          type="button"
          onClick={closeWidget}
          className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
          aria-label="Close timer panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mx-auto flex h-[148px] w-[148px] items-center justify-center">
        <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r={RING_R}
            fill="none"
            className="stroke-white/[0.08]"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r={RING_R}
            fill="none"
            className={cn(ringColor(mode), "transition-[stroke-dashoffset] duration-300 ease-linear")}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="relative text-center">
          <p className="text-3xl font-bold tabular-nums tracking-tight text-white">{formatTime(secondsRemaining)}</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
            {mode === "focus" ? "Focus" : mode === "shortBreak" ? "Short break" : "Long break"}
          </p>
        </div>
      </div>

      <p className="mb-3 text-center text-xs text-white/50">{sessionLine}</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(
          [
            { id: "focus" as const, label: "Focus" },
            { id: "shortBreak" as const, label: "Short break" },
            { id: "longBreak" as const, label: "Long break" },
          ] as const
        ).map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setMode(b.id)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition sm:text-xs",
              mode === b.id
                ? "border-purple-500/50 bg-purple-500/20 text-white"
                : "border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/80"
            )}
          >
            {b.label}
            <span className="block text-[10px] font-normal text-white/35">
              {b.id === "focus" ? "25m" : b.id === "shortBreak" ? "5m" : "15m"}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {isRunning ? (
          <button type="button" onClick={pause} className={cn(gradientBtn, "flex-1")}>
            <Pause className="h-4 w-4" />
            Pause
          </button>
        ) : (
          <button type="button" onClick={play} className={cn(gradientBtn, "flex-1")}>
            <Play className="h-4 w-4" />
            Play
          </button>
        )}
        <button type="button" onClick={reset} className={cn(gradientBtn, "flex-1")}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>
    </div>
  );
}

function PomodoroMini() {
  const { mode, secondsRemaining, isRunning, openWidget } = usePomodoro();
  const total = POMODORO_DURATIONS[mode];
  const show = isRunning || secondsRemaining < total;

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={openWidget}
      className={cn(
        "fixed bottom-5 right-5 z-[91] flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#0e0e14]/95 py-2.5 pl-3 pr-4 shadow-xl shadow-black/40 backdrop-blur-xl transition hover:border-purple-500/35 hover:bg-[#12121a]/95"
      )}
      aria-label="Open Pomodoro timer"
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full",
          mode === "focus" && "bg-purple-500/25 text-purple-200",
          mode === "shortBreak" && "bg-emerald-500/20 text-emerald-200",
          mode === "longBreak" && "bg-sky-500/20 text-sky-200"
        )}
      >
        <Timer className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold tabular-nums text-white">{formatTime(secondsRemaining)}</span>
      {isRunning ? (
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400/90" aria-hidden />
      ) : null}
    </button>
  );
}

function PomodoroToast() {
  const { toastMessage, dismissToast } = usePomodoro();
  if (!toastMessage) return null;
  return (
    <div className="fixed bottom-[5.5rem] left-1/2 z-[93] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 rounded-xl border border-purple-500/30 bg-[#12121a]/95 px-4 py-3 text-center text-sm text-white/95 shadow-xl shadow-purple-950/40 backdrop-blur-xl sm:bottom-auto sm:top-6">
      <p>{toastMessage}</p>
      <button
        type="button"
        onClick={dismissToast}
        className="mt-2 text-xs font-medium text-purple-300 underline-offset-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}

export function PomodoroPortal() {
  const { widgetExpanded } = usePomodoro();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <>
      <PomodoroToast />
      {widgetExpanded ? <PomodoroExpanded /> : <PomodoroMini />}
    </>,
    document.body
  );
}
