"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStudaraTheme } from "@/components/theme-provider";

export function ThemeToggle({
  className,
  variant = "full",
}: {
  className?: string;
  /** `full` = sidebar row; `icon` = square button for compact headers */
  variant?: "full" | "icon";
}) {
  const { theme, toggleTheme } = useStudaraTheme();
  const isDark = theme === "dark";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={cn(
          "inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--hover-bg)]",
          className
        )}
      >
        {isDark ? <Sun className="h-[18px] w-[18px]" strokeWidth={2} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={2} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm font-medium text-[var(--text)] transition-colors duration-200 hover:bg-[var(--hover-bg)]",
        className
      )}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 shrink-0 text-amber-300/95" strokeWidth={2} />
          <span>Light mode</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={2} />
          <span>Dark mode</span>
        </>
      )}
    </button>
  );
}
