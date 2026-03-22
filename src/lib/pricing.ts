/** Display + math for Pro plans (must match Stripe product amounts). */
export const PRO_MONTHLY_USD = 14;
export const PRO_ANNUAL_TOTAL_USD = 134;

export const proAnnualMonthlyEquivalent = PRO_ANNUAL_TOTAL_USD / 12;

/** vs paying monthly for 12 months */
export const proAnnualSavingsUsd = PRO_MONTHLY_USD * 12 - PRO_ANNUAL_TOTAL_USD;

/** Rounded for marketing copy */
export const proAnnualApproxPercentOff = Math.round(
  (1 - PRO_ANNUAL_TOTAL_USD / (PRO_MONTHLY_USD * 12)) * 100
);

export type BillingInterval = "month" | "year";

export function formatUsd(n: number, digits = 2): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
