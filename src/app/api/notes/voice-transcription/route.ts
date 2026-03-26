import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { del } from "@vercel/blob";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAnthropicKey } from "@/lib/anthropic";
import { anthropicImproveVoiceTranscription } from "@/lib/anthropic-improve-note";
import { hasOpenAIKey, transcribeAudioWithWhisper } from "@/lib/openai-whisper";
import { htmlToPlainText, normalizeImprovedNoteHtml } from "@/lib/note-content-html";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";
import { normalizeOptionalCategoryId } from "@/lib/category-id";

/** Same UUID shape as category ids; used for `append_note_id`. */
function parseOptionalNoteUuid(raw: unknown): string | null {
  return normalizeOptionalCategoryId(raw);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Request body size limit for multipart fallback (must stay in sync with `MAX_BYTES` and `next.config.ts`). */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

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

function mimeAllowedFile(file: File): boolean {
  const t = (file.type || "").toLowerCase().split(";")[0]!.trim();
  if (t && ALLOWED_MIME.has(t)) return true;
  const ext = extFromName(file.name || "");
  return ["mp3", "mp4", "m4a", "wav", "webm"].includes(ext);
}

function mimeAllowedStrings(mimeType: string, filename: string): boolean {
  const t = mimeType.toLowerCase().split(";")[0]!.trim();
  if (t && ALLOWED_MIME.has(t)) return true;
  const ext = extFromName(filename);
  return ["mp3", "mp4", "m4a", "wav", "webm"].includes(ext);
}

function defaultMimeForFile(file: File): string {
  const t = (file.type || "").toLowerCase().split(";")[0]!.trim();
  if (t && t !== "application/octet-stream") return t;
  return defaultMimeForFilename(file.name || "audio", "");
}

function defaultMimeForFilename(filename: string, contentTypeHint: string): string {
  const t = contentTypeHint.toLowerCase().split(";")[0]!.trim();
  if (t && t !== "application/octet-stream") return t;
  const ext = extFromName(filename);
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a") return "audio/m4a";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "audio/webm";
  return "application/octet-stream";
}

/** Only fetch blobs we uploaded to our Vercel Blob store (prevents SSRF). */
function isTrustedVercelBlobUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
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

type VoiceJsonBody = {
  blobUrl?: unknown;
  filename?: unknown;
  contentType?: unknown;
  category_id?: unknown;
  append_note_id?: unknown;
  skip_persist?: unknown;
};

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

  let buf: Buffer;
  let mime: string;
  let safeName: string;
  let categoryId: string | null;
  let appendNoteId: string | null;
  let skipPersist: boolean;
  let blobUrlToDelete: string | null = null;

  const contentTypeHeader = req.headers.get("content-type") ?? "";

  if (contentTypeHeader.includes("application/json")) {
    let body: VoiceJsonBody;
    try {
      body = (await req.json()) as VoiceJsonBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const blobUrl = typeof body.blobUrl === "string" ? body.blobUrl.trim() : "";
    if (!blobUrl || !isTrustedVercelBlobUrl(blobUrl)) {
      return NextResponse.json(
        { error: "Invalid or missing blobUrl. Use a URL from Vercel Blob (voice upload)." },
        { status: 400 }
      );
    }
    blobUrlToDelete = blobUrl;

    const dl = await fetch(blobUrl, { redirect: "follow" });
    if (!dl.ok) {
      return NextResponse.json(
        { error: "Could not download audio from blob storage. Try uploading again." },
        { status: 502 }
      );
    }
    const contentLen = dl.headers.get("content-length");
    if (contentLen != null && Number(contentLen) > MAX_BYTES) {
      return NextResponse.json(
        { error: "That file is too large. Maximum size is 25MB." },
        { status: 400 }
      );
    }

    buf = Buffer.from(await dl.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "That file is too large. Maximum size is 25MB." },
        { status: 400 }
      );
    }

    safeName =
      typeof body.filename === "string" && body.filename.trim()
        ? body.filename.trim().slice(0, 240)
        : "recording.webm";
    const ctHint = typeof body.contentType === "string" ? body.contentType : "";
    mime = defaultMimeForFilename(safeName, ctHint);
    if (!mimeAllowedStrings(mime, safeName)) {
      return NextResponse.json(
        { error: "Unsupported format. Use MP3, MP4, WAV, M4A, or a browser recording (WebM)." },
        { status: 400 }
      );
    }

    const categoryRaw = body.category_id;
    categoryId = normalizeOptionalCategoryId(categoryRaw);
    if (typeof categoryRaw === "string" && categoryRaw.trim() !== "" && categoryId === null) {
      console.warn("[voice-transcription] dropped invalid category_id (not a UUID):", categoryRaw.slice(0, 80));
    }

    skipPersist = body.skip_persist === true;
    const appendRaw = body.append_note_id;
    appendNoteId = null;
    if (typeof appendRaw === "string" && appendRaw.trim() !== "") {
      appendNoteId = parseOptionalNoteUuid(appendRaw);
      if (appendNoteId === null) {
        return NextResponse.json({ error: "Invalid note id for append." }, { status: 400 });
      }
    }
  } else {
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

    if (!mimeAllowedFile(file)) {
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
    categoryId = normalizeOptionalCategoryId(categoryRaw);
    if (typeof categoryRaw === "string" && categoryRaw.trim() !== "" && categoryId === null) {
      console.warn("[voice-transcription] dropped invalid category_id (not a UUID):", categoryRaw.slice(0, 80));
    }

    buf = Buffer.from(await file.arrayBuffer());
    mime = defaultMimeForFile(file);
    safeName = file.name?.trim() || "recording.webm";

    skipPersist = form.get("skip_persist") === "true";
    const appendRaw = form.get("append_note_id");
    appendNoteId = null;
    if (typeof appendRaw === "string" && appendRaw.trim() !== "") {
      appendNoteId = parseOptionalNoteUuid(appendRaw);
      if (appendNoteId === null) {
        return NextResponse.json({ error: "Invalid note id for append." }, { status: 400 });
      }
    }
  }

  try {
    if (skipPersist && appendNoteId) {
      return NextResponse.json(
        { error: "Cannot combine append_note_id and skip_persist." },
        { status: 400 }
      );
    }

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

    let finalContent: string;
    try {
      const improved = await anthropicImproveVoiceTranscription(session.user.id, transcript);
      finalContent = normalizeImprovedNoteHtml(improved);
    } catch (e) {
      console.error("[voice-transcription] Claude improve failed", e);
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "Failed to improve transcribed notes. Please try again.",
        },
        { status: 502 }
      );
    }

    const improvedAt = new Date().toISOString();

    async function finishWithUsageJson(extra: Record<string, unknown>) {
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
        improve_applied: true,
        ...extra,
        ...streakJson(streak),
      });
    }

    if (skipPersist) {
      console.log("[voice-transcription] skip_persist (draft append), contentLen:", finalContent.length);
      return finishWithUsageJson({
        draft_append: true,
        content: finalContent,
      });
    }

    if (appendNoteId) {
      const { data: existingRow, error: fetchErr } = await supabaseAdmin
        .from("notes")
        .select("id, content")
        .eq("id", appendNoteId)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (fetchErr || !existingRow) {
        console.error("[voice-transcription] append fetch note:", fetchErr?.message);
        return NextResponse.json({ error: "Note not found." }, { status: 404 });
      }

      const existingContent = typeof existingRow.content === "string" ? existingRow.content : "";
      const hasBody = htmlToPlainText(existingContent).trim().length > 0;
      const mergedContent = hasBody ? `${existingContent}<hr />${finalContent}` : finalContent;

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("notes")
        .update({ content: mergedContent, improved_at: improvedAt })
        .eq("id", appendNoteId)
        .eq("user_id", session.user.id)
        .select()
        .single();

      if (updateErr || !updated) {
        console.error("[voice-transcription] append update failed:", {
          message: updateErr?.message,
          code: updateErr?.code,
          details: updateErr?.details,
          hint: updateErr?.hint,
        });
        return NextResponse.json(
          {
            error: updateErr?.message ?? "Couldn't update your note. Please try again.",
            code: updateErr?.code,
            details: updateErr?.details,
            hint: updateErr?.hint,
          },
          { status: 500 }
        );
      }

      console.log("[voice-transcription] appended to note:", appendNoteId, "mergedLen:", mergedContent.length);
      return finishWithUsageJson({
        ...updated,
        appended: true,
      });
    }

    const insertPayload = {
      user_id: session.user.id,
      category_id: categoryId,
      title,
      content: finalContent,
      pinned: false,
      tags: [] as string[],
      improved_at: improvedAt,
    };
    console.log("[voice-transcription] inserting note:", {
      user_id: session.user.id,
      category_id: categoryId,
      titleLen: title.length,
      contentLen: finalContent.length,
      improve_applied: true,
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

    return finishWithUsageJson(inserted);
  } finally {
    if (blobUrlToDelete) {
      try {
        await del(blobUrlToDelete);
      } catch (e) {
        console.warn("[voice-transcription] blob cleanup failed:", e);
      }
    }
  }
}
