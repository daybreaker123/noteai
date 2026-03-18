import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json([], { status: 200 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json([], { status: 200 });
  }
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("user_id", session.user.id)
    .order("name");
  if (error) return NextResponse.json([], { status: 200 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Please log in to create categories" },
      { status: 401 }
    );
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Database not configured. Please contact support." },
      { status: 500 }
    );
  }
  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }
  const userId = session.user.id as string;

  // Get category count - if query fails, default to allowing creation
  let count = 0;
  const { data: categories, error: countError } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("user_id", userId);
  if (!countError) {
    count = categories?.length ?? 0;
  }

  // Get plan - if query fails or no row, default to pro (unlimited) to avoid blocking creation
  let plan: "free" | "pro" = "pro";
  const planRes = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (!planRes.error && planRes.data?.plan === "free") {
    plan = "free";
  }

  if (plan !== "pro" && count >= 5) {
    return NextResponse.json(
      { error: "Free tier limited to 5 categories. Upgrade to Pro for unlimited.", code: "FREE_LIMIT_CATEGORIES" },
      { status: 402 }
    );
  }
  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert({
      user_id: userId,
      name,
    })
    .select()
    .single();
  if (error) {
    const msg = error.message ?? "Failed to create category";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  if (!data?.id) {
    return NextResponse.json(
      { error: "Category was created but could not be retrieved" },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}
