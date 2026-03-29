"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { BillingCheckoutCards } from "@/components/billing-checkout-cards";
import { ProFeatureList } from "@/components/pro-plan-selector";
import { ThemeToggle } from "@/components/theme-toggle";

function BillingPageInner() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const emphasizeAnnual = searchParams.get("interval") === "year";
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("checkout_error");
    if (fromQuery) {
      setError(fromQuery);
    }
  }, []);

  if (status === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--text)] antialiased">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full blur-[100px]"
          style={{ background: `radial-gradient(circle, var(--page-glow-from), transparent 65%)` }}
        />
        <div className="absolute top-1/3 right-0 h-[280px] w-[420px] translate-x-1/4 rounded-full bg-blue-500/[0.05] blur-[90px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/notes"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          ← Back to Notes
        </Link>
        <ThemeToggle variant="icon" />
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--btn-default-bg)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
              <Sparkles className="h-3.5 w-3.5" />
              Pro
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Upgrade to Pro</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            Pick monthly or annual billing, then complete checkout on Stripe. Annual saves about{" "}
            <span className="font-medium text-[var(--text)]">20%</span> vs paying month-by-month.
          </p>

          {error && (
            <div className="mt-6 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-fg)]">
              {error}
            </div>
          )}

          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Choose your plan</h2>
            <div className="mt-4">
              <BillingCheckoutCards onError={setError} emphasizeAnnual={emphasizeAnnual} />
            </div>
          </div>

          <Card className="mt-10 border-[var(--border)] bg-[var(--chrome-30)] p-6 backdrop-blur-xl sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Everything in Pro</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              One subscription unlocks unlimited AI across notes, tutor, essays, citations, study guides, voice, slides,
              and concept maps—plus spaced repetition, streaks, exports, sharing, and faster responses when models are busy.
            </p>
            <div className="mt-6">
              <ProFeatureList />
            </div>
          </Card>

          <p className="mt-8 text-center text-xs leading-relaxed text-[var(--faint)]">
            Secure payment via Stripe. Subscriptions renew until canceled.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function BillingPage() {
  return (
    <React.Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
          <div className="text-[var(--muted)]">Loading…</div>
        </main>
      }
    >
      <BillingPageInner />
    </React.Suspense>
  );
}
