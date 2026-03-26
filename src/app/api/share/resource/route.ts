import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const resource_type = searchParams.get("resource_type");
  const resource_id = searchParams.get("resource_id");
  if (resource_type !== "note" && resource_type !== "study_set") {
    return NextResponse.json({ error: "Invalid resource_type" }, { status: 400 });
  }
  if (!resource_id || !/^[0-9a-f-]{36}$/i.test(resource_id)) {
    return NextResponse.json({ error: "Invalid resource_id" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("shared_content")
    .select("id, is_public")
    .eq("content_type", resource_type)
    .eq("content_id", resource_id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ share: null });
  }
  return NextResponse.json({ share: { share_id: data.id, is_public: data.is_public } });
}
