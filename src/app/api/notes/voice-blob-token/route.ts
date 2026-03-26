import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

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

/**
 * How long the client token remains valid for `put()` (large uploads).
 * The Blob SDK uses `validUntil` (epoch ms), not an `expiresIn` seconds option.
 */
const VOICE_BLOB_TOKEN_TTL_MS = 300 * 1000; // 300 seconds = 5 minutes

/**
 * Issues a short-lived client token so the browser can call `put()` from `@vercel/blob/client`
 * and upload audio directly to Blob (bypasses Vercel’s ~4.5MB serverless request body limit).
 */
export async function POST(request: Request) {
  const rw = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!rw) {
    return NextResponse.json(
      { error: "Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN for large voice uploads." },
      { status: 503 }
    );
  }

  let pathname: string;
  try {
    const body = (await request.json()) as { pathname?: unknown };
    pathname = typeof body.pathname === "string" ? body.pathname.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!pathname || !VOICE_PATH.test(pathname)) {
    return NextResponse.json({ error: "Invalid pathname" }, { status: 400 });
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

  try {
    const validUntil = Date.now() + VOICE_BLOB_TOKEN_TTL_MS;
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: rw,
      pathname,
      maximumSizeInBytes: MAX_VOICE_BYTES,
      allowedContentTypes: ALLOWED_CONTENT_TYPES,
      addRandomSuffix: true,
      validUntil,
    });
    return NextResponse.json({ token: clientToken });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token generation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
