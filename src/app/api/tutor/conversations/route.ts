import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserPlanFromDb } from "@/lib/user-plan";

export const dynamic = "force-dynamic";

function logSupabaseError(context: string, err: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(`[tutor/conversations] ${context}`, {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
  });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!supabaseAdmin) {
      console.error("[tutor/conversations GET] supabaseAdmin is null — check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const month = new Date().toISOString().slice(0, 7);

    const plan = await getUserPlanFromDb(userId);

    let tutorMessagesUsed = 0;
    let tutorImagesUsed = 0;
    if (plan !== "pro") {
      const { data: usage, error: usageError } = await supabaseAdmin
        .from("ai_usage")
        .select("tutor_messages, tutor_images")
        .eq("user_id", userId)
        .eq("month", month)
        .maybeSingle();

      if (usageError) {
        logSupabaseError("ai_usage lookup (non-fatal; using zeros)", usageError);
      }
      tutorMessagesUsed = usage?.tutor_messages ?? 0;
      tutorImagesUsed = usage?.tutor_images ?? 0;
    }

    const { data: conversations, error: convError } = await supabaseAdmin
      .from("tutor_conversations")
      .select("id, title, updated_at, created_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (convError) {
      logSupabaseError("tutor_conversations SELECT failed", convError);
      const hint =
        convError.code === "42P01" || /does not exist|relation/i.test(convError.message)
          ? "Run Supabase migrations (see supabase/migrations/20250317_tutor.sql) so public.tutor_conversations exists."
          : convError.hint;
      return NextResponse.json(
        {
          error: convError.message,
          code: convError.code,
          details: convError.details,
          hint: hint ?? undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      plan,
      tutorMessagesUsed,
      tutorMessagesLimit: plan === "pro" ? null : 20,
      tutorImagesUsed,
      tutorImagesLimit: plan === "pro" ? null : 5,
      conversations: conversations ?? [],
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[tutor/conversations GET] unhandled exception", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { error: err.message || "Internal server error", code: "UNHANDLED" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!supabaseAdmin) {
      console.error("[tutor/conversations POST] supabaseAdmin is null");
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const body = (await req.json().catch(() => ({}))) as { title?: string };
    const title = (body.title?.trim() || "New chat").slice(0, 120);

    const conversationInsert = { user_id: userId, title };

    const { data: row, error } = await supabaseAdmin
      .from("tutor_conversations")
      .insert(conversationInsert)
      .select("id, title, updated_at, created_at")
      .single();

    if (error) {
      logSupabaseError("tutor_conversations INSERT failed", error);
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details, hint: error.hint },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversation: row });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[tutor/conversations POST] unhandled exception", err.message, err.stack);
    return NextResponse.json({ error: err.message, code: "UNHANDLED" }, { status: 500 });
  }
}
