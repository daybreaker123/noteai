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
    "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    default: "border-[var(--border)] bg-white/10 hover:bg-white/15 text-[var(--text)]",
    ghost: "border-transparent bg-transparent hover:bg-white/10 text-[var(--text)]",
    danger: "border-transparent bg-[var(--danger)]/90 hover:bg-[var(--danger)] text-white",
    success: "border-transparent bg-[var(--accent2)]/90 hover:bg-[var(--accent2)] text-black",
  };
  const sizes: Record<string, string> = {
    sm: "h-9 px-3",
    md: "h-10 px-3.5",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-[var(--border)] bg-white/5 px-3 text-sm text-[var(--text)] outline-none placeholder:text-white/40 focus:ring-2 focus:ring-[var(--accent)]/40",
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
        "min-h-40 w-full resize-y rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-white/40 focus:ring-2 focus:ring-[var(--accent)]/40",
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
