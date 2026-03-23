import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const userId = session.user.id;
  const month = new Date().toISOString().slice(0, 7);

  let plan: "free" | "pro" = "free";
  const { data: planRow } = await supabaseAdmin.from("user_plans").select("plan").eq("user_id", userId).single();
  plan = planRow?.plan === "pro" ? "pro" : "free";

  let tutorMessagesUsed = 0;
  let tutorImagesUsed = 0;
  if (plan !== "pro") {
    const { data: usage } = await supabaseAdmin
      .from("ai_usage")
      .select("tutor_messages, tutor_images")
      .eq("user_id", userId)
      .eq("month", month)
      .single();
    tutorMessagesUsed = usage?.tutor_messages ?? 0;
    tutorImagesUsed = usage?.tutor_images ?? 0;
  }

  const { data: conversations, error } = await supabaseAdmin
    .from("tutor_conversations")
    .select("id, title, updated_at, created_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    plan,
    tutorMessagesUsed,
    tutorMessagesLimit: plan === "pro" ? null : 20,
    tutorImagesUsed,
    tutorImagesLimit: plan === "pro" ? null : 5,
    conversations: conversations ?? [],
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = (body.title?.trim() || "New chat").slice(0, 120);

  const conversationInsert = { user_id: session.user.id, title };
  console.log("[tutor/conversations POST] tutor_conversations insert", {
    table: "tutor_conversations",
    payload: conversationInsert,
    nullFields: Object.fromEntries(
      Object.entries(conversationInsert).filter(([, v]) => v === null || v === undefined)
    ),
  });

  const { data: row, error } = await supabaseAdmin
    .from("tutor_conversations")
    .insert(conversationInsert)
    .select("id, title, updated_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversation: row });
}
