"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { BillingCheckoutCards } from "@/components/billing-checkout-cards";
import { ProFeatureList } from "@/components/pro-plan-selector";

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
      <main className="flex min-h-dvh items-center justify-center bg-[#0a0a0f]">
        <div className="text-white/60">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#0a0a0f] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-purple-500/[0.07] blur-[100px]" />
        <div className="absolute top-1/3 right-0 h-[280px] w-[420px] translate-x-1/4 rounded-full bg-blue-500/[0.05] blur-[90px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <Link
          href="/notes"
          className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white/90"
        >
          ← Back to Notes
        </Link>

        <div className="mt-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Pro
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Upgrade to Pro</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
            Pick monthly or annual billing, then complete checkout on Stripe. Annual saves about{" "}
            <span className="font-medium text-white/85">20%</span> vs paying month-by-month.
          </p>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200/95">
              {error}
            </div>
          )}

          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Choose your plan</h2>
            <div className="mt-4">
              <BillingCheckoutCards onError={setError} emphasizeAnnual={emphasizeAnnual} />
            </div>
          </div>

          <Card className="mt-10 border-white/10 bg-black/30 p-6 backdrop-blur-xl sm:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Everything in Pro</h2>
            <div className="mt-5">
              <ProFeatureList />
            </div>
          </Card>

          <p className="mt-8 text-center text-xs leading-relaxed text-white/40">
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
        <main className="flex min-h-dvh items-center justify-center bg-[#0a0a0f]">
          <div className="text-white/60">Loading…</div>
        </main>
      }
    >
      <BillingPageInner />
    </React.Suspense>
  );
}
