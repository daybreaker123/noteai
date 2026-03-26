"use client";

import Link from "next/link";
import { StudaraWordmark } from "@/components/studara-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";

export function SharedPublicShell({
  children,
  pageTitle,
}: {
  children: React.ReactNode;
  pageTitle: string;
}) {
  return (
    <div className="relative min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/14 via-blue-500/10 to-fuchsia-500/10 blur-3xl" />
      </div>
      <header className="relative z-10 border-b border-[var(--sidebar-border)] bg-[var(--header-bar)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <StudaraWordmark />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle variant="icon" />
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--placeholder)]">Shared</span>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">{pageTitle}</h1>
        <div className="mt-8">{children}</div>
      </main>
      <footer className="relative z-10 mx-auto max-w-3xl px-5 pb-12 pt-4 sm:px-8">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] p-6 text-center">
          <p className="text-sm text-[var(--muted)]">Create, improve, and study your own notes with AI.</p>
          <Link
            href="/signup"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-[var(--inverse-text)] shadow-lg shadow-purple-900/30 transition hover:from-purple-500 hover:to-indigo-500"
          >
            Sign up to create your own notes
          </Link>
        </div>
      </footer>
    </div>
  );
}
