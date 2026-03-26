"use client";

import * as React from "react";
import { STUDARA_THEME_STORAGE_KEY, type StudaraTheme } from "@/lib/theme-constants";

type ThemeContextValue = {
  theme: StudaraTheme;
  setTheme: (t: StudaraTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readThemeFromDocument(): StudaraTheme {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" ? "light" : "dark";
}

function applyDomTheme(theme: StudaraTheme, withTransition: boolean) {
  const root = document.documentElement;
  if (withTransition) {
    root.setAttribute("data-theme-switching", "");
    window.setTimeout(() => root.removeAttribute("data-theme-switching"), 400);
  }
  root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STUDARA_THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<StudaraTheme>("dark");

  React.useLayoutEffect(() => {
    setThemeState(readThemeFromDocument());
  }, []);

  const setTheme = React.useCallback((t: StudaraTheme) => {
    setThemeState(t);
    applyDomTheme(t, true);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyDomTheme(next, true);
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useStudaraTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useStudaraTheme must be used within ThemeProvider");
  }
  return ctx;
}
