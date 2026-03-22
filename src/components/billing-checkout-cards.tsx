"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { startProCheckout } from "@/lib/pro-checkout";
import {
  formatUsd,
  proAnnualApproxPercentOff,
  proAnnualMonthlyEquivalent,
  PRO_ANNUAL_TOTAL_USD,
  proAnnualSavingsUsd,
  PRO_MONTHLY_USD,
} from "@/lib/pricing";

type Busy = null | "month" | "year";

const btnGradient =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-purple-500 hover:to-blue-500 disabled:opacity-60";

const badgeGradient =
  "rounded-full border border-white/10 bg-gradient-to-r from-purple-500/35 to-blue-500/30 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/95";

const badgeMuted = "rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-white/75";

export function BillingCheckoutCards({
  onError,
  emphasizeAnnual = false,
}: {
  onError: (message: string) => void;
  /** From landing links e.g. `/billing?interval=year` */
  emphasizeAnnual?: boolean;
}) {
  const [busy, setBusy] = React.useState<Busy>(null);

  async function checkout(interval: "month" | "year") {
    setBusy(interval);
    try {
      const result = await startProCheckout({ interval });
      if (result.ok === false) {
        onError(result.error);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Monthly — dashboard-style card */}
      <Card className="flex flex-col border-white/10 bg-black/30 p-6 backdrop-blur-xl">
        <div className="text-sm font-semibold tracking-tight text-white/90">Monthly Pro</div>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight text-white">{formatUsd(PRO_MONTHLY_USD, 0)}</span>
          <span className="text-white/50">/month</span>
        </div>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-white/50">Billed monthly. Cancel anytime.</p>
        <button type="button" disabled={busy !== null} onClick={() => void checkout("month")} className={cn(btnGradient, "mt-6")}>
          {busy === "month" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy === "month" ? "Redirecting…" : "Get Monthly Pro"}
        </button>
      </Card>

      {/* Annual — gradient frame + same inner card treatment */}
      <div
        className={cn(
          "relative rounded-2xl p-[1px]",
          emphasizeAnnual && "ring-2 ring-purple-500/45 ring-offset-2 ring-offset-[#0a0a0f]"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/40 via-blue-500/25 to-fuchsia-500/20 opacity-90"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl shadow-[0_0_40px_-8px_rgba(139,92,246,0.35)]"
          aria-hidden
        />
        <Card className="relative flex h-full flex-col border-white/10 bg-black/40 p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white/95">Annual Pro</span>
            <span className={badgeGradient}>Best value</span>
            <span className={badgeGradient}>{proAnnualApproxPercentOff}% off</span>
            <span className={badgeMuted}>Save {formatUsd(proAnnualSavingsUsd, 0)}/year</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight text-white">{formatUsd(proAnnualMonthlyEquivalent)}</span>
            <span className="text-white/50">/month</span>
          </div>
          <p className="mt-2 text-sm font-medium text-white/75">{formatUsd(PRO_ANNUAL_TOTAL_USD, 0)} billed once per year</p>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-white/45">
            Equivalent to {formatUsd(proAnnualMonthlyEquivalent)}/mo vs paying monthly.
          </p>
          <button type="button" disabled={busy !== null} onClick={() => void checkout("year")} className={cn(btnGradient, "mt-6")}>
            {busy === "year" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy === "year" ? "Redirecting…" : "Get Annual Pro"}
          </button>
        </Card>
      </div>
    </div>
  );
}
