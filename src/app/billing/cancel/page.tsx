"use client";

import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0f] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-white">Checkout cancelled</h1>
        <p className="mt-2 text-white/70">
          No charges were made. You can upgrade anytime from the app or landing page.
        </p>
        <Link
          href="/notes"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          Back to Notes
        </Link>
      </div>
    </main>
  );
}
