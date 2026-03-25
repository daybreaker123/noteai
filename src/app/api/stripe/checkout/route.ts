import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { stripe } from "@/lib/stripe";
import { authOptions } from "@/lib/auth";
import { getNextAuthUrl } from "@/lib/auth-url";

export const runtime = "nodejs";

const LOG_PREFIX = "[api/stripe/checkout]";

function readEnv() {
  const monthlyPriceId = process.env.STRIPE_PRICE_ID?.trim() ?? "";
  const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID?.trim() ?? "";
  const appUrlRaw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const appUrl =
    getNextAuthUrl() ||
    (appUrlRaw && appUrlRaw.length > 0 ? appUrlRaw.replace(/\/$/, "") : "") ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  const hasStripeSecret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  return { monthlyPriceId, annualPriceId, appUrl, hasStripeSecret };
}

function maskKeyHint(): string {
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  if (!k) return "(missing)";
  if (k.length <= 12) return `${k.slice(0, 4)}…`;
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}

export async function POST(req: Request) {
  let interval: "month" | "year" = "month";
  try {
    const data = (await req.json()) as { interval?: string };
    if (data?.interval === "year") interval = "year";
  } catch {
    /* empty or invalid body → monthly */
  }

  const { monthlyPriceId, annualPriceId, appUrl, hasStripeSecret } = readEnv();
  const priceId = interval === "year" ? annualPriceId : monthlyPriceId;

  console.info(`${LOG_PREFIX} env check:`, {
    interval,
    STRIPE_SECRET_KEY: hasStripeSecret ? maskKeyHint() : "(missing or empty)",
    STRIPE_PRICE_ID: monthlyPriceId ? `${monthlyPriceId.slice(0, 8)}…` : "(missing or empty)",
    STRIPE_ANNUAL_PRICE_ID: annualPriceId ? `${annualPriceId.slice(0, 8)}…` : "(missing or empty)",
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET?.trim() ? "set" : "MISSING — JWT/session cannot be decoded; set in .env.local",
  });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Please log in to upgrade" }, { status: 401 });
  }

  if (!appUrl) {
    console.error(`${LOG_PREFIX} Missing app URL: set NEXTAUTH_URL or NEXT_PUBLIC_APP_URL`);
    return NextResponse.json(
      {
        error:
          "Server URL not configured — set NEXTAUTH_URL (or NEXT_PUBLIC_APP_URL) to your deployment origin.",
      },
      { status: 503 }
    );
  }

  const missingPriceEnv =
    interval === "year" ? "STRIPE_ANNUAL_PRICE_ID" : "STRIPE_PRICE_ID";
  if (!stripe || !priceId) {
    const missing: string[] = [];
    if (!stripe) missing.push("STRIPE_SECRET_KEY");
    if (!priceId) missing.push(missingPriceEnv);
    console.error(`${LOG_PREFIX} Stripe not configured. Missing: ${missing.join(", ")}`);
    return NextResponse.json(
      { error: `Stripe not configured (set ${missing.join(" and ")})` },
      { status: 503 }
    );
  }

  const userId = session.user.id.trim();
  const email = session.user.email?.trim() ?? "";

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      client_reference_id: userId,
      customer_email: email || undefined,
      metadata: {
        user_id: userId,
        email: email || "",
        billing_interval: interval,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          email: email || "",
          billing_interval: interval,
        },
      },
    });

    const url = checkout.url;
    if (!url) {
      console.error(`${LOG_PREFIX} Stripe returned session with no url`, { sessionId: checkout.id });
      return NextResponse.json({ error: "Could not create checkout session" }, { status: 500 });
    }
    return NextResponse.json({ url });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error(`${LOG_PREFIX} Stripe checkout.sessions.create failed:`, message);
    if (stack) {
      console.error(stack);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
