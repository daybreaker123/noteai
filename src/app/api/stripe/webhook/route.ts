import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getSubscriptionPeriodEndUnix } from "@/lib/stripe-subscription";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";
import { sendProUpgradeEmail } from "@/lib/email/send-transactional";
import type { BillingCycleLabel } from "@/lib/email/pro-upgrade-html";

export const runtime = "nodejs";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const LOG = "[stripe/webhook]";

/** Subscription id from Checkout Session (string id or expanded Subscription object). */
function subscriptionIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const sub = session.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "id" in sub && typeof (sub as Stripe.Subscription).id === "string") {
    return (sub as Stripe.Subscription).id;
  }
  return null;
}

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
  const { error, data } = await supabaseAdmin.from("user_plans").upsert(row, { onConflict: "user_id" }).select();
  if (error) {
    console.error(`${LOG} user_plans upsert PostgREST error`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      userId,
      stripe_subscription_id: subscriptionId,
    });
  } else {
    console.log(`${LOG} user_plans upsert ok`, {
      userId,
      stripe_subscription_id: subscriptionId,
      returnedRows: Array.isArray(data) ? data.length : 0,
    });
  }
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
      let session = event.data.object as Stripe.Checkout.Session;

      // Webhook payloads sometimes omit or under-expand `subscription`. Re-fetch so we always get sub_… id.
      if (session.mode === "subscription" && session.id) {
        try {
          session = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ["subscription", "subscription.items"],
          });
        } catch (retrieveErr) {
          console.error(`${LOG} checkout.session.completed: sessions.retrieve failed`, {
            sessionId: session.id,
            err: retrieveErr instanceof Error ? retrieveErr.message : retrieveErr,
          });
        }
      }

      // Prefer session metadata (set at checkout); fallback to client_reference_id (same NextAuth user id / cuid)
      const fromMeta = session.metadata?.user_id?.trim();
      const fromRef =
        typeof session.client_reference_id === "string" ? session.client_reference_id.trim() : "";
      const userId = fromMeta || fromRef || null;
      if (!userId) {
        console.warn(`${LOG} checkout.session.completed: missing user_id (metadata + client_reference_id)`, {
          sessionId: session.id,
          mode: session.mode,
        });
        return NextResponse.json({ received: true, warning: "no user_id" });
      }

      let subscriptionId = subscriptionIdFromCheckoutSession(session);
      if (!subscriptionId && session.mode === "subscription") {
        console.warn(`${LOG} checkout.session.completed: subscription id still null after expand`, {
          sessionId: session.id,
          paymentStatus: session.payment_status,
          status: session.status,
          subscriptionField: session.subscription,
        });
      }

      let periodEndSec: number | null = null;
      let cancelAtPeriodEnd = false;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        periodEndSec = getSubscriptionPeriodEndUnix(sub);
        cancelAtPeriodEnd = sub.cancel_at_period_end;
      }

      console.log(`${LOG} checkout.session.completed`, {
        sessionId: session.id,
        userId,
        subscriptionId,
        hasSubscriptionId: Boolean(subscriptionId),
        source: fromMeta ? "metadata.user_id" : "client_reference_id",
      });

      const { error } = await upsertProWithSubscription(
        userId,
        subscriptionId,
        periodEndSec,
        cancelAtPeriodEnd
      );
      if (error) {
        return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
      }

      if (session.mode === "subscription") {
        try {
          const userRow = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
          });
          const cust = session.customer_details;
          const detailsEmail =
            cust && typeof cust === "object" && "email" in cust && cust.email
              ? String(cust.email).trim()
              : "";
          const to =
            userRow?.email?.trim() ||
            (session.customer_email ? String(session.customer_email).trim() : "") ||
            detailsEmail ||
            null;
          if (to) {
            const rawInterval = session.metadata?.billing_interval?.trim();
            const billingCycle: BillingCycleLabel = rawInterval === "year" ? "annual" : "monthly";
            void sendProUpgradeEmail({
              to,
              name: userRow?.name ?? null,
              amountCents: session.amount_total,
              currency: session.currency,
              billingCycle,
            });
          }
        } catch (emailErr) {
          console.error(`${LOG} Pro upgrade email failed (non-fatal):`, emailErr);
        }
      }
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
