import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProUsageState } from "@/lib/pro-api-usage";
import { getUserPlanFromDb } from "@/lib/user-plan";

export const runtime = "nodejs";

/**
 * Authoritative plan for UI: same `user_plans` lookup as tutor/API routes via {@link getUserPlanFromDb}.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id?.trim() ?? null;

  if (!sessionUserId) {
    return NextResponse.json({ plan: "free" });
  }

  const plan = await getUserPlanFromDb(sessionUserId);

  let proHeavyUsage = false;
  let proEstimatedSpendCents = 0;
  if (plan === "pro") {
    const st = await getProUsageState(sessionUserId);
    proHeavyUsage = st.heavyUsage;
    proEstimatedSpendCents = st.estimatedSpendCents;
  }

  console.log("[api/me/plan]", { sessionUserId, plan, proHeavyUsage });

  return NextResponse.json({ plan, proHeavyUsage, proEstimatedSpendCents });
}
