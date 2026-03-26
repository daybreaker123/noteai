import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VOICE_BYTES = 25 * 1024 * 1024;

/** Must align with voice transcription allowed types. */
const ALLOWED_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "video/mp4",
  "application/octet-stream",
];

const VOICE_PATH = /^voice\/[a-zA-Z0-9._-]{1,200}$/;

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN for large voice uploads." },
      { status: 503 }
    );
  }

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
        error: "Voice to Notes is a Pro feature — upgrade to record or upload lecture audio.",
        code: "PRO_FEATURE_VOICE_TRANSCRIPTION",
      },
      { status: 402 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!VOICE_PATH.test(pathname)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_VOICE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload token failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
