import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getProUsageState } from "@/lib/pro-api-usage";

export const runtime = "nodejs";

/**
 * Same `user_plans` lookup as `/api/me/profile`: `select('plan').eq('user_id', session.user.id).single()`
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id?.trim() ?? null;

  if (!sessionUserId) {
    return NextResponse.json({ plan: "free" });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ plan: "free" });
  }

  const { data, error: planError } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", sessionUserId)
    .single();

  let planValue: string | null = null;
  if (!planError || planError.code === "PGRST116") {
    planValue = data?.plan != null && typeof data.plan === "string" ? data.plan : null;
  } else {
    console.error("[api/me/plan] user_plans plan query failed:", planError.message);
  }

  const raw = planValue != null ? planValue.trim().toLowerCase() : "";
  const plan = raw === "pro" ? "pro" : "free";

  let proHeavyUsage = false;
  let proEstimatedSpendCents = 0;
  if (plan === "pro" && sessionUserId) {
    const st = await getProUsageState(sessionUserId);
    proHeavyUsage = st.heavyUsage;
    proEstimatedSpendCents = st.estimatedSpendCents;
  }

  console.log("[api/me/plan]", { sessionUserId, planRaw: planValue, plan, proHeavyUsage });

  return NextResponse.json({ plan, proHeavyUsage, proEstimatedSpendCents });
}
