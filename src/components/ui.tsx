import * as React from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    default: "border-[var(--border)] bg-white/10 hover:bg-white/15 text-[var(--text)]",
    ghost: "border-transparent bg-transparent hover:bg-white/10 text-[var(--text)]",
    danger: "border-transparent bg-[var(--danger)]/90 hover:bg-[var(--danger)] text-white",
    success: "border-transparent bg-[var(--accent2)]/90 hover:bg-[var(--accent2)] text-black",
  };
  const sizes: Record<string, string> = {
    sm: "min-h-11 min-w-[44px] px-3 py-2.5 sm:h-9 sm:min-h-0 sm:min-w-0 sm:py-2",
    md: "min-h-11 min-w-[44px] px-3.5 py-2.5 sm:h-10 sm:min-h-0 sm:min-w-0 sm:py-2",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-base text-[var(--text)] outline-none placeholder:text-white/40 focus:ring-2 focus:ring-[var(--accent)]/40 sm:min-h-10 sm:py-2 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-40 w-full resize-y rounded-xl border border-[var(--border)] bg-white/5 px-3 py-3 text-base text-[var(--text)] outline-none placeholder:text-white/40 focus:ring-2 focus:ring-[var(--accent)]/40 sm:py-2.5 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--border)] bg-white/5 px-2 py-0.5 text-xs text-[var(--muted)]",
        className,
      )}
      {...props}
    />
  );
}
