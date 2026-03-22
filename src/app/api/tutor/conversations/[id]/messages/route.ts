import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { id: conversationId } = await params;

  const { data: conv, error: convErr } = await supabaseAdmin
    .from("tutor_conversations")
    .select("id, user_id, title")
    .eq("id", conversationId)
    .single();

  if (convErr || !conv || conv.user_id !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages, error } = await supabaseAdmin
    .from("tutor_messages")
    .select("id, role, content, attachments, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    conversation: { id: conv.id, title: conv.title },
    messages: messages ?? [],
  });
}
