"use client";

import * as React from "react";
import { Check } from "lucide-react";
import {
  formatUsd,
  proAnnualApproxPercentOff,
  proAnnualMonthlyEquivalent,
  PRO_ANNUAL_TOTAL_USD,
  proAnnualSavingsUsd,
  PRO_MONTHLY_USD,
  type BillingInterval,
} from "@/lib/pricing";

const PRO_FEATURES = [
  "Unlimited notes",
  "Unlimited categories",
  "Unlimited AI summarization",
  "Unlimited AI improvements",
  "Unlimited AI tutor messages",
  "Unlimited tutor image uploads",
  "AI chat with your notes",
  "AI auto-categorization",
  "AI writing assistant",
  "Semantic AI search",
  "PDF and Markdown export",
  "Study mode with flashcards and quizzes",
  "Priority support",
];

export function ProPlanSelector({
  value,
  onChange,
  variant = "billing",
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
  /** `billing` = large selectable cards; `compact` = tighter for landing */
  variant?: "billing" | "compact";
}) {
  const cardBase =
    variant === "billing"
      ? "rounded-2xl border p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60"
      : "rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60";

  return (
    <div
      className={
        variant === "billing"
          ? "grid gap-4 sm:grid-cols-2"
          : "grid grid-cols-1 gap-3 sm:grid-cols-2"
      }
    >
      <button
        type="button"
        onClick={() => onChange("month")}
        className={`${cardBase} ${
          value === "month"
            ? "border-purple-500/50 bg-purple-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.25)]"
            : "border-white/12 bg-white/[0.02] hover:border-white/20"
        }`}
      >
        <div className="text-sm font-semibold text-white/90">Monthly</div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">{formatUsd(PRO_MONTHLY_USD, 0)}</span>
          <span className="text-white/50">/month</span>
        </div>
        <p className="mt-2 text-xs text-white/45">Billed every month. Cancel anytime.</p>
      </button>

      <button
        type="button"
        onClick={() => onChange("year")}
        className={`${cardBase} relative ${
          value === "year"
            ? "border-purple-500/45 bg-purple-500/10 shadow-[0_0_0_1px_rgba(168,85,247,0.3)]"
            : "border-white/12 bg-white/[0.02] hover:border-white/20"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white/90">Annual</span>
          <span className="rounded-full border border-white/10 bg-gradient-to-r from-purple-500/35 to-blue-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90">
            Save {formatUsd(proAnnualSavingsUsd, 0)}/year
          </span>
          <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/75">
            ~{proAnnualApproxPercentOff}% off
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <span className="text-3xl font-bold text-white">{formatUsd(proAnnualMonthlyEquivalent)}</span>
          <span className="text-white/50">/month equivalent</span>
        </div>
        <p className="mt-1 text-sm font-medium text-white/80">
          {formatUsd(PRO_ANNUAL_TOTAL_USD, 0)} billed once per year
        </p>
        <p className="mt-2 text-xs text-white/45">Lowest price when you commit yearly.</p>
      </button>
    </div>
  );
}

export function ProFeatureList({ className = "" }: { className?: string }) {
  return (
    <ul className={`space-y-3 ${className}`}>
      {PRO_FEATURES.map((feature) => (
        <li key={feature} className="flex items-start gap-3 text-sm text-white/80">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

export { PRO_FEATURES };
