import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getEmbedding } from "@/lib/openai-embeddings";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { id } = await params;
  if (!id || id.startsWith("draft-") || id === "undefined") {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }
  const body = (await req.json()) as {
    title?: string;
    content?: string;
    category_id?: string | null;
    pinned?: boolean;
    tags?: string[];
  };
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.content !== undefined) update.content = body.content;
  if (body.category_id !== undefined) {
    update.category_id = body.category_id === "" || body.category_id === null ? null : body.category_id;
  }
  if (body.pinned !== undefined) update.pinned = body.pinned;
  if (body.tags !== undefined) update.tags = body.tags;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("notes")
    .update(update)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const planRes = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  const plan = planRes.data?.plan === "pro" ? "pro" : "free";
  if (plan === "pro" && (body.content !== undefined || body.title !== undefined)) {
    const text = [data?.title ?? "", data?.content ?? ""].join("\n").slice(0, 8000);
    if (text.trim()) {
      const embedding = await getEmbedding(text);
      if (embedding) {
        await supabaseAdmin
          .from("notes")
          .update({ embedding })
          .eq("id", id)
          .eq("user_id", session.user.id);
      }
    }
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { id } = await params;
  if (!id || id.startsWith("draft-") || id === "undefined") {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
