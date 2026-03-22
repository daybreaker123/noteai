import type Stripe from "stripe";

/**
 * Stripe API versions may expose period end on subscription items instead of the subscription root.
 */
export function getSubscriptionPeriodEndUnix(sub: Stripe.Subscription): number {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  if (typeof fromItem === "number") {
    return fromItem;
  }
  const legacy = sub as unknown as { current_period_end?: number };
  if (typeof legacy.current_period_end === "number") {
    return legacy.current_period_end;
  }
  return Math.floor(Date.now() / 1000);
}
