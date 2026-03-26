import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const bodySchema = z.object({
  resource_type: z.enum(["note", "study_set"]),
  resource_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { resource_type, resource_id } = parsed;
  const uid = session.user.id;

  if (resource_type === "note") {
    const { data: note, error: nErr } = await supabaseAdmin
      .from("notes")
      .select("id")
      .eq("id", resource_id)
      .eq("user_id", uid)
      .maybeSingle();
    if (nErr || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
  } else {
    const { data: setRow, error: sErr } = await supabaseAdmin
      .from("study_sets")
      .select("id")
      .eq("id", resource_id)
      .eq("user_id", uid)
      .maybeSingle();
    if (sErr || !setRow) {
      return NextResponse.json({ error: "Study set not found" }, { status: 404 });
    }
  }

  const { data: existing } = await supabaseAdmin
    .from("shared_content")
    .select("id, is_public")
    .eq("content_type", resource_type)
    .eq("content_id", resource_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      share_id: existing.id,
      is_public: existing.is_public,
    });
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("shared_content")
    .insert({
      user_id: uid,
      content_type: resource_type,
      content_id: resource_id,
      is_public: true,
    })
    .select("id, is_public")
    .single();

  if (insErr || !inserted) {
    if (insErr?.code === "23505") {
      const { data: again } = await supabaseAdmin
        .from("shared_content")
        .select("id, is_public")
        .eq("content_type", resource_type)
        .eq("content_id", resource_id)
        .maybeSingle();
      if (again) {
        return NextResponse.json({ share_id: again.id, is_public: again.is_public });
      }
    }
    console.error("[share] insert", insErr);
    return NextResponse.json({ error: "Could not create share link" }, { status: 500 });
  }

  return NextResponse.json({
    share_id: inserted.id,
    is_public: inserted.is_public,
  });
}
