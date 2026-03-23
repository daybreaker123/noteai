import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const sessionUserId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
  if (!sessionUserId) {
    console.log("[tutor/messages GET] unauthorized (no session user id)");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { id: conversationId } = await params;
  console.log("[tutor/messages GET] request", { conversationId, sessionUserId });

  const { data: conv, error: convErr } = await supabaseAdmin
    .from("tutor_conversations")
    .select("id, user_id, title")
    .eq("id", conversationId)
    .single();

  if (convErr || !conv || conv.user_id !== sessionUserId) {
    console.warn("[tutor/messages GET] conversation not found or wrong user", {
      conversationId,
      sessionUserId,
      convErr: convErr?.message,
      convUserId: conv?.user_id,
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages, error } = await supabaseAdmin
    .from("tutor_messages")
    .select("id, role, content, attachments, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[tutor/messages GET] tutor_messages query error", { conversationId, message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("[tutor/messages GET] ok", {
    conversationId,
    messageCount: messages?.length ?? 0,
  });

  return NextResponse.json({
    conversation: { id: conv.id, title: conv.title },
    messages: messages ?? [],
  });
}
