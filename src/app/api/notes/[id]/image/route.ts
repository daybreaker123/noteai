import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "note-images";
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const { id: noteId } = await params;
  if (!noteId || noteId.startsWith("draft-") || noteId === "undefined") {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }

  const { data: note } = await supabaseAdmin
    .from("notes")
    .select("id")
    .eq("id", noteId)
    .eq("user_id", session.user.id)
    .single();
  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const extFromName = file.name.split(".").pop();
  const ext =
    extFromName && /^[a-z0-9]+$/i.test(extFromName) && extFromName.length <= 8
      ? extFromName.toLowerCase()
      : file.type === "image/png"
        ? "png"
        : file.type === "image/jpeg" || file.type === "image/jpg"
          ? "jpg"
          : file.type === "image/gif"
            ? "gif"
            : file.type === "image/webp"
              ? "webp"
              : "img";

  const objectPath = `${session.user.id}/${noteId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(objectPath, buf, {
    contentType: file.type,
    upsert: false,
  });

  if (upErr) {
    console.error("[note image upload]", upErr.message);
    return NextResponse.json(
      {
        error:
          "Could not upload image. Create a public bucket named `note-images` in Supabase Storage (see supabase/migrations for SQL) or try again.",
      },
      { status: 502 }
    );
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({ url: pub.publicUrl });
}
