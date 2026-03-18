"use client";

import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0f] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-white">Thank you!</h1>
        <p className="mt-2 text-white/70">
          Your Pro subscription is active. You now have access to all Pro features.
        </p>
        <Link
          href="/notes"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
        >
          Go to Notes
        </Link>
      </div>
    </main>
  );
}
