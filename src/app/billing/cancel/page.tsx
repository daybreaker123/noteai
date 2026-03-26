"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function BillingCancelPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle variant="icon" />
      </div>
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Checkout cancelled</h1>
        <p className="mt-2 text-[var(--muted)]">
          No charges were made. You can upgrade anytime from the app or landing page.
        </p>
        <Link
          href="/notes"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
        >
          Back to Notes
        </Link>
      </div>
    </main>
  );
}
