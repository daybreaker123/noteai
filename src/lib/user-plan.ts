import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Resolves `free` | `pro` from Supabase `user_plans` for the same id NextAuth exposes as
 * `session.user.id` (Prisma `User.id`, typically a cuid). Trims the id and normalizes plan
 * casing so lookups match `/api/me/plan` and Stripe upserts.
 */
export async function getUserPlanFromDb(userId: string | null | undefined): Promise<"free" | "pro"> {
  const id = typeof userId === "string" ? userId.trim() : "";
  if (!id || !supabaseAdmin) {
    return "free";
  }

  const { data, error } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", id)
    .maybeSingle();

  if (error) {
    console.warn("[user-plan] user_plans lookup failed:", error.message, {
      userIdPrefix: `${id.slice(0, 8)}…`,
      code: error.code,
    });
    return "free";
  }

  const raw =
    data?.plan != null && typeof data.plan === "string" ? data.plan.trim().toLowerCase() : "";
  return raw === "pro" ? "pro" : "free";
}
