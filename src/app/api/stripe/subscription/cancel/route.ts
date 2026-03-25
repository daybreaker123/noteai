import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSubscriptionPeriodEndUnix } from "@/lib/stripe-subscription";
import { getSessionUserId } from "@/lib/auth-session";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/stripe/subscription/cancel]";

export async function POST() {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!stripe || !supabaseAdmin) {
    console.error(`${LOG_PREFIX} Stripe or Supabase not configured`);
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("user_plans")
    .select("stripe_subscription_id, plan")
    .eq("user_id", sessionUserId)
    .maybeSingle();

  if (fetchErr) {
    console.error(`${LOG_PREFIX} user_plans fetch failed:`, fetchErr);
    return NextResponse.json({ error: "Could not load subscription" }, { status: 500 });
  }

  const subId = row?.stripe_subscription_id;
  const planNorm =
    row?.plan != null && typeof row.plan === "string" ? row.plan.trim().toLowerCase() : "";
  if (!subId || planNorm !== "pro") {
    return NextResponse.json(
      { error: "No active Pro subscription linked to your account. Complete checkout first or contact support." },
      { status: 400 }
    );
  }

  try {
    const updatedSub = await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
    });

    const periodEnd = new Date(getSubscriptionPeriodEndUnix(updatedSub) * 1000).toISOString();

    const { error: upErr } = await supabaseAdmin
      .from("user_plans")
      .update({
        subscription_cancel_at_period_end: true,
        subscription_current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", sessionUserId);

    if (upErr) {
      console.error(`${LOG_PREFIX} Supabase update failed after Stripe cancel:`, upErr);
      return NextResponse.json(
        { error: "Subscription scheduled to cancel in Stripe, but we could not save status. Contact support." },
        { status: 500 }
      );
    }

    console.info(`${LOG_PREFIX} cancel_at_period_end set for subscription`);
    return NextResponse.json({
      ok: true,
      subscriptionCurrentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`${LOG_PREFIX} Stripe API error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
