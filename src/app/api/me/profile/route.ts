import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { limitsForPlan } from "@/lib/plan-limits";

export const runtime = "nodejs";

/** Optional columns — only present after running the Supabase migration for Stripe fields. */
async function fetchUserPlanStripeExtras(userId: string): Promise<{
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean | null;
} | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("user_plans")
    .select("stripe_subscription_id, subscription_current_period_end, subscription_cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error?.code === "42703") {
    // Migration not applied — table has no Stripe columns yet
    return null;
  }
  if (error) {
    console.warn("[api/me/profile] optional user_plans stripe columns:", error.message);
    return null;
  }
  return data;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id?.trim() ?? null;

  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, name: true, email: true, image: true, createdAt: true },
  });
  if (!user) {
    console.warn("[api/me/profile] Prisma user not found for authenticated session");
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const month = new Date().toISOString().slice(0, 7);
  const startOfMonth = new Date(`${month}-01T00:00:00.000Z`).toISOString();

  let planValue: string | null = null;
  let stripeExtras: {
    stripe_subscription_id: string | null;
    subscription_current_period_end: string | null;
    subscription_cancel_at_period_end: boolean | null;
  } | null = null;

  let usageRow: {
    summarizations: number;
    improvements: number;
    tutor_messages: number;
    tutor_images: number;
  } | null = null;
  let totalNotes = 0;
  let notesThisMonth = 0;

  if (supabaseAdmin) {
    // Exact pattern: only `plan` so it works even if Stripe columns are not migrated yet.
    const {
      data,
      error: planError,
    } = await supabaseAdmin.from("user_plans").select("plan").eq("user_id", sessionUserId).single();

    if (planError && planError.code !== "PGRST116") {
      console.error("[api/me/profile] user_plans plan query failed:", planError.message);
    }

    // PGRST116 = no row — treat as free
    if (!planError || planError.code === "PGRST116") {
      planValue = data?.plan != null && typeof data.plan === "string" ? data.plan : null;
    } else {
      planValue = null;
    }

    stripeExtras = await fetchUserPlanStripeExtras(sessionUserId);

    const { data: u } = await supabaseAdmin
      .from("ai_usage")
      .select("summarizations, improvements, tutor_messages, tutor_images")
      .eq("user_id", sessionUserId)
      .eq("month", month)
      .maybeSingle();
    usageRow = u;

    const { count: tn } = await supabaseAdmin
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", sessionUserId);
    totalNotes = tn ?? 0;

    const { count: nm } = await supabaseAdmin
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", sessionUserId)
      .gte("created_at", startOfMonth);
    notesThisMonth = nm ?? 0;
  }

  const planRaw =
    planValue != null && typeof planValue === "string" ? planValue.trim().toLowerCase() : "";
  const tier: "free" | "pro" = planRaw === "pro" ? "pro" : "free";

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt?.toISOString() ?? null,
    },
    plan: {
      tier,
      planRawFromSupabase: planValue,
      stripeSubscriptionId: stripeExtras?.stripe_subscription_id ?? null,
      subscriptionCurrentPeriodEnd: stripeExtras?.subscription_current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(stripeExtras?.subscription_cancel_at_period_end),
    },
    usage: {
      month,
      notesThisMonth,
      totalNotes,
      summarizations: usageRow?.summarizations ?? 0,
      improvements: usageRow?.improvements ?? 0,
      tutorMessages: usageRow?.tutor_messages ?? 0,
      tutorImages: usageRow?.tutor_images ?? 0,
    },
    limits: limitsForPlan(tier),
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id?.trim() ?? null;
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = body.name;
  const name = typeof raw === "string" ? raw.trim().slice(0, 120) : "";
  if (!name) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: sessionUserId },
    data: { name },
    select: { id: true, name: true, email: true, image: true, createdAt: true },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      image: updated.image,
      createdAt: updated.createdAt?.toISOString() ?? null,
    },
  });
}
