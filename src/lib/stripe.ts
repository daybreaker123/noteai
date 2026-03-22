import Stripe from "stripe";

/**
 * Reads `STRIPE_SECRET_KEY` at module load. Test keys start with `sk_test_`, live with `sk_live_`.
 */
function readStripeSecret(): string | undefined {
  const raw = process.env.STRIPE_SECRET_KEY;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}

const stripeSecret = readStripeSecret();

if (process.env.NODE_ENV === "development" && !stripeSecret) {
  console.warn("[stripe] STRIPE_SECRET_KEY is missing or empty — Stripe API routes will return 503.");
}

/** `null` when `STRIPE_SECRET_KEY` is unset (check with `if (!stripe)`). */
export const stripe: Stripe | null = stripeSecret
  ? new Stripe(stripeSecret, {
      typescript: true,
    })
  : null;
