import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserPlanFromDb } from "@/lib/user-plan";
import { ANTHROPIC_MODEL_HAIKU, ANTHROPIC_MODEL_SONNET } from "@/lib/anthropic-models";

/** $10 soft limit for Pro heavy-usage messaging + Sonnet→Haiku downgrade */
export const PRO_SOFT_LIMIT_CENTS = 1000;

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function isSonnetModelId(model: string): boolean {
  return model === ANTHROPIC_MODEL_SONNET || model.includes("claude-sonnet");
}

function isHaikuModelId(model: string): boolean {
  return model === ANTHROPIC_MODEL_HAIKU || model.includes("claude-haiku");
}

function estimateCentsForResolvedModel(model: string, variant: "complete" | "stream"): number {
  const sonnet = variant === "stream" ? 6 : 4;
  const haiku = variant === "stream" ? 2 : 1;
  if (isHaikuModelId(model)) return haiku;
  return sonnet;
}

export type ProUsageState = {
  isPro: boolean;
  /** True when estimated spend >= soft limit (show banner + downgrade Sonnet). */
  heavyUsage: boolean;
  estimatedSpendCents: number;
};

export async function getProUsageState(userId: string): Promise<ProUsageState> {
  if (!supabaseAdmin) {
    return { isPro: false, heavyUsage: false, estimatedSpendCents: 0 };
  }
  const id = userId.trim();
  const plan = await getUserPlanFromDb(id);
  const isPro = plan === "pro";
  if (!isPro) {
    return { isPro: false, heavyUsage: false, estimatedSpendCents: 0 };
  }
  const m = monthKey();
  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select("pro_estimated_api_cents")
    .eq("user_id", id)
    .eq("month", m)
    .maybeSingle();
  const estimatedSpendCents = row?.pro_estimated_api_cents ?? 0;
  return {
    isPro: true,
    heavyUsage: estimatedSpendCents >= PRO_SOFT_LIMIT_CENTS,
    estimatedSpendCents,
  };
}

/**
 * If Pro and over soft spend limit, downgrade Sonnet → Haiku (same request shape).
 * Returns model to call and cents to record for this call.
 */
export async function resolveAnthropicModelForProUser(
  userId: string | undefined,
  requestedModel: string,
  variant: "complete" | "stream" = "complete"
): Promise<{ model: string; estimateCents: number }> {
  if (!userId || !supabaseAdmin) {
    return { model: requestedModel, estimateCents: estimateCentsForResolvedModel(requestedModel, variant) };
  }
  const { isPro, heavyUsage } = await getProUsageState(userId);
  if (!isPro || !heavyUsage) {
    return { model: requestedModel, estimateCents: estimateCentsForResolvedModel(requestedModel, variant) };
  }
  if (isSonnetModelId(requestedModel)) {
    return {
      model: ANTHROPIC_MODEL_HAIKU,
      estimateCents: estimateCentsForResolvedModel(ANTHROPIC_MODEL_HAIKU, variant),
    };
  }
  return { model: requestedModel, estimateCents: estimateCentsForResolvedModel(requestedModel, variant) };
}

/** Record estimated spend for Pro users only (after a successful API call). */
export async function recordProApiSpendEstimate(userId: string | undefined, cents: number): Promise<void> {
  if (!userId || !supabaseAdmin || cents <= 0) return;
  const id = userId.trim();
  const plan = await getUserPlanFromDb(id);
  if (plan !== "pro") return;

  const month = monthKey();
  const { data: existing } = await supabaseAdmin
    .from("ai_usage")
    .select("pro_estimated_api_cents")
    .eq("user_id", id)
    .eq("month", month)
    .maybeSingle();

  const next = (existing?.pro_estimated_api_cents ?? 0) + cents;
  if (existing) {
    await supabaseAdmin
      .from("ai_usage")
      .update({ pro_estimated_api_cents: next })
      .eq("user_id", id)
      .eq("month", month);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      user_id: id,
      month,
      pro_estimated_api_cents: cents,
    });
  }
}
