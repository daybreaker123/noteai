import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAnthropicKey } from "@/lib/anthropic";
import { anthropicImproveNoteContent } from "@/lib/anthropic-improve-note";
import { hasOpenAIKey, transcribeAudioWithWhisper } from "@/lib/openai-whisper";
import { migratePlainTextToHtml, normalizeImprovedNoteHtml } from "@/lib/note-content-html";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";
import { normalizeOptionalCategoryId } from "@/lib/category-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
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
]);

function extFromName(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function mimeAllowed(file: File): boolean {
  const t = (file.type || "").toLowerCase().split(";")[0]!.trim();
  if (t && ALLOWED_MIME.has(t)) return true;
  const ext = extFromName(file.name || "");
  return ["mp3", "mp4", "m4a", "wav", "webm"].includes(ext);
}

function defaultMimeForFile(file: File): string {
  const t = (file.type || "").toLowerCase().split(";")[0]!.trim();
  if (t && t !== "application/octet-stream") return t;
  const ext = extFromName(file.name || "");
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a") return "audio/m4a";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "audio/webm";
  return "application/octet-stream";
}

async function incrementVoiceTranscription(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const month = new Date().toISOString().slice(0, 7);
  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select("voice_transcription")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();
  const next = (row?.voice_transcription ?? 0) + 1;
  if (row) {
    await supabaseAdmin
      .from("ai_usage")
      .update({ voice_transcription: next })
      .eq("user_id", userId)
      .eq("month", month);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      month,
      voice_transcription: 1,
    });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  if (!hasOpenAIKey()) {
    return NextResponse.json(
      { error: "Voice transcription is not configured. Add OPENAI_API_KEY to your environment." },
      { status: 503 }
    );
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { error: "AI not configured. Add ANTHROPIC_API_KEY to improve transcribed notes." },
      { status: 503 }
    );
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("audio");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  if (!mimeAllowed(file)) {
    return NextResponse.json(
      { error: "Unsupported format. Use MP3, MP4, WAV, M4A, or a browser recording (WebM)." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is too large. Maximum size is 25MB." },
      { status: 400 }
    );
  }

  const categoryRaw = form.get("category_id");
  const categoryId = normalizeOptionalCategoryId(categoryRaw);
  if (typeof categoryRaw === "string" && categoryRaw.trim() !== "" && categoryId === null) {
    console.warn("[voice-transcription] dropped invalid category_id (not a UUID):", categoryRaw.slice(0, 80));
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = defaultMimeForFile(file);
  const safeName = file.name?.trim() || "recording.webm";

  let transcript: string;
  try {
    transcript = await transcribeAudioWithWhisper(buf, safeName, mime);
  } catch (e) {
    console.error("[voice-transcription] whisper", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Transcription failed" },
      { status: 502 }
    );
  }

  console.log("[voice-transcription] whisper raw transcript:", {
    length: transcript.length,
    text: transcript,
  });

  if (!transcript.trim()) {
    return NextResponse.json(
      { error: "No speech could be detected in that audio. Try a clearer recording." },
      { status: 422 }
    );
  }

  const title = `Lecture Transcription — ${new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
  const rawHtml = migratePlainTextToHtml(transcript);

  let finalContent = rawHtml;
  let improvedOk = false;
  try {
    const improved = await anthropicImproveNoteContent(session.user.id, rawHtml);
    finalContent = normalizeImprovedNoteHtml(improved);
    improvedOk = true;
  } catch (e) {
    console.error("[voice-transcription] improve", e);
    finalContent = rawHtml;
  }

  const insertPayload = {
    user_id: session.user.id,
    category_id: categoryId,
    title,
    content: finalContent,
    pinned: false,
    tags: [] as string[],
    ...(improvedOk ? { improved_at: new Date().toISOString() } : {}),
  };
  console.log("[voice-transcription] inserting note:", {
    user_id: session.user.id,
    category_id: categoryId,
    titleLen: title.length,
    contentLen: finalContent.length,
    improve_applied: improvedOk,
  });

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("notes")
    .insert(insertPayload)
    .select()
    .single();

  if (insertErr || !inserted) {
    console.error("[voice-transcription] insert failed:", {
      message: insertErr?.message,
      code: insertErr?.code,
      details: insertErr?.details,
      hint: insertErr?.hint,
    });
    return NextResponse.json(
      {
        error: insertErr?.message ?? "Couldn't save your note. Please try again.",
        code: insertErr?.code,
        details: insertErr?.details,
        hint: insertErr?.hint,
      },
      { status: 500 }
    );
  }

  try {
    await incrementVoiceTranscription(session.user.id);
  } catch (e) {
    console.warn("[voice-transcription] incrementVoiceTranscription:", e);
  }

  let streak;
  try {
    streak = await recordStudyActivity(session.user.id);
  } catch (e) {
    console.warn("[voice-transcription] recordStudyActivity:", e);
    streak = { current_streak: 0, milestone: null };
  }

  return NextResponse.json({
    ...inserted,
    improve_applied: improvedOk,
    ...streakJson(streak),
  });
}
