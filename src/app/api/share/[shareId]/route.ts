import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const patchSchema = z.object({
  is_public: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { shareId } = await params;
  if (!shareId) {
    return NextResponse.json({ error: "Invalid share id" }, { status: 400 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data: row, error: findErr } = await supabaseAdmin
    .from("shared_content")
    .select("id, user_id")
    .eq("id", shareId)
    .maybeSingle();

  if (findErr || !row) {
    return NextResponse.json({ error: "Share not found" }, { status: 404 });
  }
  if (row.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: upErr } = await supabaseAdmin
    .from("shared_content")
    .update({ is_public: body.is_public, updated_at: new Date().toISOString() })
    .eq("id", shareId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, is_public: body.is_public });
}
