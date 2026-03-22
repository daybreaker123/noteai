import type { BillingInterval } from "@/lib/pricing";

export type ProCheckoutResult =
  | { ok: true; kind: "redirect_stripe" | "redirect_login" }
  | { ok: false; error: string };

export type StartProCheckoutOptions = {
  /** Defaults to monthly (`STRIPE_PRICE_ID`). Use `year` for `STRIPE_ANNUAL_PRICE_ID`. */
  interval?: BillingInterval;
};

/**
 * Start Stripe Checkout for Pro. Call only from the browser (client components).
 * On 401, sends the user to login with return path `/billing`.
 */
export async function startProCheckout(
  opts?: StartProCheckoutOptions
): Promise<ProCheckoutResult> {
  const interval = opts?.interval === "year" ? "year" : "month";
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ interval }),
  });

  if (res.status === 401) {
    const next = encodeURIComponent("/billing");
    window.location.href = `/login?callbackUrl=${next}`;
    return { ok: true, kind: "redirect_login" };
  }

  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (res.ok && data.url) {
    window.location.href = data.url;
    return { ok: true, kind: "redirect_stripe" };
  }

  const message =
    data.error ??
    (res.status === 503
      ? "Checkout isn’t configured yet. Add Stripe keys in your environment."
      : "Couldn’t start checkout. Try again or visit Billing.");

  const onBilling = typeof window !== "undefined" && window.location.pathname === "/billing";
  if (!onBilling) {
    const q = new URLSearchParams({ checkout_error: message });
    window.location.href = `/billing?${q.toString()}`;
    return { ok: false, error: message };
  }

  return { ok: false, error: message };
}
