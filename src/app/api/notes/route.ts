import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { FREE_NOTE_TOTAL } from "@/lib/plan-limits";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Notes database is not configured" },
      { status: 503 }
    );
  }
  const { data, error } = await supabaseAdmin
    .from("notes")
    .select("*")
    .eq("user_id", session.user.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load notes" },
      { status: 500 }
    );
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { category_id, title } = (await req.json()) as {
    category_id?: string | null;
    title?: string;
  };
  /** Omit or null = uncategorized (matches "All Notes" new note). */
  const categoryId = category_id === undefined || category_id === null || category_id === "" ? null : category_id;
  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";
  if (plan !== "pro") {
    const { count } = await supabaseAdmin
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id);
    if ((count ?? 0) >= FREE_NOTE_TOTAL) {
      return NextResponse.json(
        {
          error: "You've reached the free limit — upgrade to Pro for unlimited notes",
          code: "FREE_LIMIT_NOTES",
        },
        { status: 402 }
      );
    }
  }
  const { data, error } = await supabaseAdmin
    .from("notes")
    .insert({
      user_id: session.user.id,
      category_id: categoryId,
      title: title ?? "Untitled",
      content: "",
      pinned: false,
      tags: [],
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const streak = await recordStudyActivity(session.user.id);
  return NextResponse.json({ ...data, ...streakJson(streak) });
}
