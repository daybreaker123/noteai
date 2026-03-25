import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * DELETE — remove conversation and all messages (FK cascade on tutor_messages).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { id: conversationId } = await params;
  if (!conversationId?.trim()) {
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  const { data: conv, error: convErr } = await supabaseAdmin
    .from("tutor_conversations")
    .select("id, user_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convErr) {
    console.error("[tutor/conversations DELETE] lookup error", convErr.message, convErr.code);
    return NextResponse.json({ error: convErr.message }, { status: 500 });
  }
  if (!conv || conv.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: delErr } = await supabaseAdmin.from("tutor_conversations").delete().eq("id", conversationId);

  if (delErr) {
    console.error("[tutor/conversations DELETE] delete error", delErr.message, delErr.code);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
