import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getSubscriptionPeriodEndUnix } from "@/lib/stripe-subscription";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function upsertProWithSubscription(
  userId: string,
  subscriptionId: string | null,
  periodEndSec: number | null,
  cancelAtPeriodEnd: boolean
) {
  if (!supabaseAdmin) return { error: "no supabase" as const };
  const row: Record<string, unknown> = {
    user_id: userId,
    plan: "pro",
    updated_at: new Date().toISOString(),
    stripe_subscription_id: subscriptionId,
    subscription_cancel_at_period_end: cancelAtPeriodEnd,
  };
  if (periodEndSec != null) {
    row.subscription_current_period_end = new Date(periodEndSec * 1000).toISOString();
  }
  const { error } = await supabaseAdmin.from("user_plans").upsert(row, { onConflict: "user_id" });
  return { error };
}

/**
 * Stripe webhooks must receive the raw body for signature verification.
 */
export async function POST(req: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    console.error("Supabase admin not configured");
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      // Prefer session metadata (set at checkout); fallback to client_reference_id (same NextAuth user id / cuid)
      const fromMeta = session.metadata?.user_id?.trim();
      const fromRef =
        typeof session.client_reference_id === "string" ? session.client_reference_id.trim() : "";
      const userId = fromMeta || fromRef || null;
      if (!userId) {
        console.warn("checkout.session.completed: missing user_id (metadata + client_reference_id)", session.id);
        return NextResponse.json({ received: true, warning: "no user_id" });
      }
      console.log("[stripe/webhook] checkout.session.completed", {
        sessionId: session.id,
        userId,
        userIdLength: userId.length,
        source: fromMeta ? "metadata.user_id" : "client_reference_id",
      });

      const subRef = session.subscription;
      const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id ?? null;

      let periodEndSec: number | null = null;
      let cancelAtPeriodEnd = false;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        periodEndSec = getSubscriptionPeriodEndUnix(sub);
        cancelAtPeriodEnd = sub.cancel_at_period_end;
      }

      const { error } = await upsertProWithSubscription(
        userId,
        subscriptionId,
        periodEndSec,
        cancelAtPeriodEnd
      );
      if (error) {
        console.error("user_plans upsert failed:", error);
        return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
      }
      console.log("[stripe/webhook] user_plans upserted plan=pro for user_id", userId);
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id?.trim();
      if (!userId) {
        console.warn("customer.subscription.updated: missing metadata.user_id", sub.id);
        return NextResponse.json({ received: true, warning: "no user_id in metadata" });
      }
      const { error } = await upsertProWithSubscription(
        userId,
        sub.id,
        getSubscriptionPeriodEndUnix(sub),
        sub.cancel_at_period_end
      );
      if (error) {
        console.error("user_plans upsert failed (subscription.updated):", error);
        return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id?.trim();
      if (!userId) {
        console.warn("customer.subscription.deleted: missing metadata.user_id", sub.id);
        return NextResponse.json({ received: true, warning: "no user_id in metadata" });
      }
      const { error } = await supabaseAdmin.from("user_plans").upsert(
        {
          user_id: userId,
          plan: "free",
          updated_at: new Date().toISOString(),
          stripe_subscription_id: null,
          subscription_current_period_end: null,
          subscription_cancel_at_period_end: false,
        },
        { onConflict: "user_id" }
      );
      if (error) {
        console.error("user_plans downgrade failed:", error);
        return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
      }
    }
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
