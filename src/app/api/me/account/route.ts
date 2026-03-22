import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth-session";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

const LOG = "[api/me/account]";

/**
 * Permanently delete the signed-in user: Supabase app data, optional Stripe subscription, then Prisma User (sessions + accounts cascade).
 */
export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (stripe && supabaseAdmin) {
      const { data: planRow } = await supabaseAdmin
        .from("user_plans")
        .select("stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();

      const subId = planRow?.stripe_subscription_id;
      if (subId && typeof subId === "string" && subId.trim().length > 0) {
        try {
          await stripe.subscriptions.cancel(subId.trim());
          console.info(`${LOG} Stripe subscription canceled: ${subId}`);
        } catch (e) {
          console.error(`${LOG} Stripe cancel (continuing with account deletion):`, e);
        }
      }
    }

    if (supabaseAdmin) {
      /** Order respects FKs: tutor messages cascade from conversations; notes reference categories (set null on category delete — delete notes first). */
      const steps: { from: string }[] = [
        { from: "tutor_conversations" },
        { from: "study_sets" },
        { from: "notes" },
        { from: "categories" },
        { from: "user_plans" },
        { from: "ai_usage" },
      ];

      for (const { from } of steps) {
        const { error } = await supabaseAdmin.from(from).delete().eq("user_id", userId);
        if (error) {
          console.error(`${LOG} Supabase delete ${from}:`, error);
          return NextResponse.json(
            { error: `Could not remove all data (${from}). Please try again or contact support.` },
            { status: 500 },
          );
        }
      }
    } else {
      console.warn(`${LOG} supabaseAdmin unavailable — skipping Supabase row deletes`);
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(LOG, e);
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
    if (code === "P2025") {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json({ error: message || "Failed to delete account" }, { status: 500 });
  }
}
