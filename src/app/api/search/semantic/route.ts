import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getEmbedding } from "@/lib/openai-embeddings";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";
  if (plan !== "pro") {
    return NextResponse.json(
      {
        error: "Semantic search is a Pro feature — upgrade to Pro",
        code: "PRO_REQUIRED_SEMANTIC",
      },
      { status: 402 }
    );
  }
  const { query } = (await req.json()) as { query?: string };
  if (!query?.trim()) {
    return NextResponse.json({ notes: [] });
  }
  const embedding = await getEmbedding(query);
  if (!embedding) {
    return NextResponse.json({ notes: [] });
  }
  const { data, error } = await supabaseAdmin.rpc("match_notes", {
    p_user_id: session.user.id,
    p_embedding: embedding,
    p_match_count: 20,
  });
  if (error) return NextResponse.json({ notes: [] });
  return NextResponse.json({ notes: data ?? [] });
}
