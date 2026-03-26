"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function BillingSuccessPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle variant="icon" />
      </div>
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Thank you!</h1>
        <p className="mt-2 text-[var(--muted)]">
          Your Pro subscription is active. You now have access to all Pro features.
        </p>
        <Link
          href="/notes"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--text)] px-4 py-2 text-sm font-semibold text-[var(--inverse-text)] hover:opacity-90"
        >
          Go to Notes
        </Link>
      </div>
    </main>
  );
}
