"use client";

import * as React from "react";

export type PomodoroMode = "focus" | "shortBreak" | "longBreak";

const STORAGE_KEY = "studara-pomodoro-v1";

export const POMODORO_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

type PersistedState = {
  mode: PomodoroMode;
  isRunning: boolean;
  endAt: number | null;
  /** Seconds left when paused (authoritative when !isRunning) */
  remainingSeconds: number;
  focusCompletedInCycle: number;
  widgetExpanded: boolean;
};

function playSoftChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => void ctx.close();
  } catch {
    /* ignore */
  }
}

function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedState;
    if (!p.mode || !POMODORO_DURATIONS[p.mode]) return null;
    const d = POMODORO_DURATIONS[p.mode];
    let remaining = typeof p.remainingSeconds === "number" ? p.remainingSeconds : d;
    let isRunning = Boolean(p.isRunning);
    let endAt: number | null = typeof p.endAt === "number" ? p.endAt : null;

    if (isRunning && endAt != null) {
      if (endAt <= Date.now()) {
        remaining = 0;
        isRunning = false;
        endAt = null;
      } else {
        remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      }
    }

    return {
      mode: p.mode,
      isRunning,
      endAt: isRunning ? endAt : null,
      remainingSeconds: Math.min(d, Math.max(0, remaining)),
      focusCompletedInCycle: Math.min(4, Math.max(0, p.focusCompletedInCycle ?? 0)),
      widgetExpanded: Boolean(p.widgetExpanded),
    };
  } catch {
    return null;
  }
}

function savePersisted(s: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

type PomodoroContextValue = {
  mode: PomodoroMode;
  secondsRemaining: number;
  isRunning: boolean;
  widgetExpanded: boolean;
  focusCompletedInCycle: number;
  toastMessage: string | null;
  dismissToast: () => void;
  setMode: (m: PomodoroMode) => void;
  openWidget: () => void;
  closeWidget: () => void;
  toggleWidget: () => void;
  play: () => void;
  pause: () => void;
  reset: () => void;
};

const PomodoroContext = React.createContext<PomodoroContextValue | null>(null);

export function usePomodoro(): PomodoroContextValue {
  const v = React.useContext(PomodoroContext);
  if (!v) throw new Error("usePomodoro must be used within PomodoroProvider");
  return v;
}

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const [storageReady, setStorageReady] = React.useState(false);
  const [mode, setModeState] = React.useState<PomodoroMode>("focus");
  const [remainingSeconds, setRemainingSeconds] = React.useState(POMODORO_DURATIONS.focus);
  const [isRunning, setIsRunning] = React.useState(false);
  const [endAt, setEndAt] = React.useState<number | null>(null);
  const [focusCompletedInCycle, setFocusCompletedInCycle] = React.useState(0);
  const [widgetExpanded, setWidgetExpanded] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const endAtRef = React.useRef<number | null>(null);
  const isRunningRef = React.useRef(false);
  const modeRef = React.useRef<PomodoroMode>("focus");
  const focusCompletedRef = React.useRef(0);
  const completedFiredRef = React.useRef(false);

  React.useEffect(() => {
    endAtRef.current = endAt;
  }, [endAt]);
  React.useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);
  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  React.useEffect(() => {
    focusCompletedRef.current = focusCompletedInCycle;
  }, [focusCompletedInCycle]);

  React.useEffect(() => {
    const p = loadPersisted();
    if (p) {
      setModeState(p.mode);
      setRemainingSeconds(p.remainingSeconds);
      setIsRunning(p.isRunning);
      setEndAt(p.endAt);
      setFocusCompletedInCycle(p.focusCompletedInCycle);
      setWidgetExpanded(p.widgetExpanded);
      endAtRef.current = p.endAt;
      isRunningRef.current = p.isRunning;
      modeRef.current = p.mode;
      focusCompletedRef.current = p.focusCompletedInCycle;
    }
    setStorageReady(true);
  }, []);

  React.useEffect(() => {
    if (!storageReady) return;
    const rem =
      isRunning && endAt != null
        ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
        : remainingSeconds;
    savePersisted({
      mode,
      isRunning,
      endAt,
      remainingSeconds: rem,
      focusCompletedInCycle,
      widgetExpanded,
    });
  }, [storageReady, mode, isRunning, endAt, focusCompletedInCycle, widgetExpanded]);

  React.useEffect(() => {
    if (!storageReady || isRunning) return;
    savePersisted({
      mode,
      isRunning,
      endAt,
      remainingSeconds,
      focusCompletedInCycle,
      widgetExpanded,
    });
  }, [storageReady, remainingSeconds, isRunning, mode, endAt, focusCompletedInCycle, widgetExpanded]);

  const handleTimerComplete = React.useCallback(() => {
    if (completedFiredRef.current) return;
    completedFiredRef.current = true;
    setIsRunning(false);
    setEndAt(null);
    endAtRef.current = null;
    isRunningRef.current = false;
    setRemainingSeconds(0);
    playSoftChime();

    const m = modeRef.current;
    if (m === "focus") {
      const next = focusCompletedRef.current + 1;
      setFocusCompletedInCycle(next);
      focusCompletedRef.current = next;

      if (next >= 4) {
        setToastMessage("Amazing — 4 focus sessions done! Time for a long break.");
      } else {
        setToastMessage("Focus session complete! Time for a break.");
      }
    } else if (m === "longBreak") {
      setFocusCompletedInCycle(0);
      focusCompletedRef.current = 0;
      setToastMessage("Long break over — ready for your next focus round.");
    } else {
      setToastMessage("Short break over — ready to focus again.");
    }
  }, []);

  React.useEffect(() => {
    if (!isRunning || endAt == null) return;

    const tick = () => {
      const ea = endAtRef.current;
      if (ea == null) return;
      const left = Math.max(0, Math.ceil((ea - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        handleTimerComplete();
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isRunning, endAt, handleTimerComplete]);

  React.useEffect(() => {
    if (toastMessage) {
      const t = window.setTimeout(() => setToastMessage(null), 6000);
      return () => window.clearTimeout(t);
    }
  }, [toastMessage]);

  const setMode = React.useCallback((m: PomodoroMode) => {
    completedFiredRef.current = false;
    setModeState(m);
    modeRef.current = m;
    const d = POMODORO_DURATIONS[m];
    setRemainingSeconds(d);
    setIsRunning(false);
    setEndAt(null);
    endAtRef.current = null;
    isRunningRef.current = false;
  }, []);

  const play = React.useCallback(() => {
    completedFiredRef.current = false;
    const secs =
      remainingSeconds > 0 ? remainingSeconds : POMODORO_DURATIONS[modeRef.current];
    const end = Date.now() + secs * 1000;
    setEndAt(end);
    endAtRef.current = end;
    setIsRunning(true);
    isRunningRef.current = true;
    setRemainingSeconds(secs);
  }, [remainingSeconds]);

  const pause = React.useCallback(() => {
    if (!isRunningRef.current || endAtRef.current == null) return;
    const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setRemainingSeconds(left);
    setIsRunning(false);
    isRunningRef.current = false;
    setEndAt(null);
    endAtRef.current = null;
  }, []);

  const reset = React.useCallback(() => {
    completedFiredRef.current = false;
    const d = POMODORO_DURATIONS[modeRef.current];
    setRemainingSeconds(d);
    setIsRunning(false);
    isRunningRef.current = false;
    setEndAt(null);
    endAtRef.current = null;
  }, []);

  const openWidget = React.useCallback(() => setWidgetExpanded(true), []);
  const closeWidget = React.useCallback(() => setWidgetExpanded(false), []);
  const toggleWidget = React.useCallback(() => setWidgetExpanded((e) => !e), []);
  const dismissToast = React.useCallback(() => setToastMessage(null), []);

  const value = React.useMemo<PomodoroContextValue>(
    () => ({
      mode,
      secondsRemaining: remainingSeconds,
      isRunning,
      widgetExpanded,
      focusCompletedInCycle,
      toastMessage,
      dismissToast,
      setMode,
      openWidget,
      closeWidget,
      toggleWidget,
      play,
      pause,
      reset,
    }),
    [
      mode,
      remainingSeconds,
      isRunning,
      widgetExpanded,
      focusCompletedInCycle,
      toastMessage,
      dismissToast,
      setMode,
      openWidget,
      closeWidget,
      toggleWidget,
      play,
      pause,
      reset,
    ]
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

