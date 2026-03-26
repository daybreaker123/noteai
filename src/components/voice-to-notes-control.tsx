"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { Mic, ChevronDown, Square, Upload } from "lucide-react";

const ACCEPT_AUDIO =
  "audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a,audio/wav,audio/webm,video/mp4,.mp3,.m4a,.wav,.mp4";

export type VoiceTranscriptionSuccessPayload = {
  id?: string;
  title?: string;
  content: string;
  category_id?: string | null;
  improve_applied?: boolean;
  /** Server merged voice output into an existing persisted note. */
  appended?: boolean;
  /** Improved HTML only; client merges into a draft (no new DB row). */
  draft_append?: boolean;
} & Record<string, unknown>;

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

type VoiceToNotesControlProps = {
  plan: "free" | "pro";
  categoryId: string | null;
  /** Persisted note id: append improved transcription after `<hr />` instead of creating a note. */
  appendNoteId?: string | null;
  /** Draft editor: return improved HTML only; parent merges into the open draft. */
  draftVoiceAppend?: boolean;
  disabled?: boolean;
  onRequirePro: () => void;
  onError: (message: string) => void;
  onSuccess: (payload: VoiceTranscriptionSuccessPayload) => void | Promise<void>;
  layout: "toolbar" | "hero" | "editor";
};

export function VoiceToNotesControl({
  plan,
  categoryId,
  appendNoteId = null,
  draftVoiceAppend = false,
  disabled = false,
  onRequirePro,
  onError,
  onSuccess,
  layout,
}: VoiceToNotesControlProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const cancelRecordingRef = React.useRef(false);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const root = menuRef.current;
      const t = e.target;
      if (root && t instanceof Node && root.contains(t)) return;
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function postAudio(file: File | Blob, filename: string) {
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append("audio", file, filename);
      if (categoryId) fd.append("category_id", categoryId);
      if (appendNoteId) fd.append("append_note_id", appendNoteId);
      if (draftVoiceAppend) fd.append("skip_persist", "true");
      const meta = {
        filename,
        size: file instanceof Blob ? file.size : undefined,
        categoryIdProp: categoryId,
        appendNoteId: appendNoteId ?? undefined,
        draftVoiceAppend,
      };
      console.log("[voice-to-notes] POST /api/notes/voice-transcription (FormData)", meta);

      const res = await fetch("/api/notes/voice-transcription", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const rawBody = await res.text();
      console.log("[voice-to-notes] voice-transcription response", {
        status: res.status,
        ok: res.ok,
        body: rawBody.slice(0, 8000),
      });

      let json: VoiceTranscriptionSuccessPayload & {
        error?: string;
        code?: string;
        details?: string;
        hint?: string;
      };
      try {
        json = JSON.parse(rawBody) as typeof json;
      } catch {
        onError(`Invalid server response (${res.status}).`);
        return;
      }

      if (json.code === "PRO_FEATURE_VOICE_TRANSCRIPTION" && res.status === 402) {
        onRequirePro();
        return;
      }
      const okPayload =
        typeof json.content === "string" &&
        (json.draft_append === true || (typeof json.id === "string" && json.id.length > 0));
      if (!res.ok || !okPayload) {
        const parts = [json.error, json.details, json.hint].filter(
          (x): x is string => typeof x === "string" && x.trim() !== ""
        );
        onError(parts.length > 0 ? parts.join(" — ") : "Voice transcription failed.");
        return;
      }
      console.log(
        "[voice-to-notes] success",
        json.draft_append ? "draft_append" : json.appended ? "appended" : "new note",
        "id:",
        json.id,
        "content length:",
        json.content?.length
      );
      await onSuccess(json);
    } catch (e) {
      console.error("[voice-to-notes] postAudio error", e);
      onError("Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  function openMicMenu() {
    if (plan !== "pro") {
      onRequirePro();
      return;
    }
    setMenuOpen((o) => !o);
  }

  async function startQuickRecord() {
    setMenuOpen(false);
    const mime = pickRecorderMime();
    if (!mime) {
      onError("Recording isn’t supported in this browser. Try Upload Audio or a different browser.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      onError("Microphone access isn’t available in this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("Microphone permission was denied or unavailable.");
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    cancelRecordingRef.current = false;
    const rec = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecording(false);
      setSeconds(0);
      if (cancelRecordingRef.current) {
        cancelRecordingRef.current = false;
        return;
      }
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      if (blob.size < 256) {
        onError("Recording was too short. Try again.");
        return;
      }
      const ext = mime.includes("webm") ? "webm" : "m4a";
      void postAudio(blob, `recording-${Date.now()}.${ext}`);
    };
    rec.start(400);
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    cancelRecordingRef.current = false;
    mediaRecorderRef.current?.stop();
  }

  function cancelRecording() {
    cancelRecordingRef.current = true;
    mediaRecorderRef.current?.stop();
  }

  function onUploadPick() {
    setMenuOpen(false);
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    void postAudio(f, f.name || "audio");
  }

  const isHero = layout === "hero";
  const isEditor = layout === "editor";

  const trigger = (
    <Button
      type="button"
      size={isHero ? "md" : "sm"}
      variant="ghost"
      disabled={disabled || recording || processing}
      className={cn(
        "gap-1.5 border border-[var(--border)] bg-[var(--btn-default-bg)] text-[var(--text)] hover:bg-[var(--btn-default-hover)]",
        isHero && "min-h-11 w-full max-w-xs justify-center",
        isEditor && "shrink-0 border-[var(--border)]"
      )}
      aria-expanded={menuOpen}
      aria-haspopup="menu"
      onClick={openMicMenu}
      title="Voice to notes"
    >
      <Mic className={cn(isHero ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden />
      {!isEditor && <span>Voice</span>}
      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
    </Button>
  );

  const menu = menuOpen && plan === "pro" && (
    <div
      role="menu"
      className={cn(
        "absolute z-[80] min-w-[15rem] rounded-xl border border-[var(--border)] bg-[var(--surface-mid)] py-1 shadow-xl shadow-black/50",
        isHero ? "left-0 right-0 mt-2" : "right-0 top-[calc(100%+6px)]"
      )}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
        onClick={() => void startQuickRecord()}
      >
        <Mic className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        Quick Record
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
        onClick={onUploadPick}
      >
        <Upload className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        Upload Audio
      </button>
    </div>
  );

  const overlays =
    mounted &&
    createPortal(
      <>
        {recording && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--overlay-scrim)] p-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-recording-title"
            aria-live="polite"
          >
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--modal-surface)] px-8 py-6 text-center shadow-xl shadow-purple-950/40">
              <div className="flex items-center justify-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
                <p id="voice-recording-title" className="text-sm font-semibold text-[var(--text)]">
                  Recording
                </p>
              </div>
              <p className="mt-4 font-mono text-3xl tabular-nums text-[var(--text)]">{formatTimer(seconds)}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">Speak clearly; tap Stop when you’re done.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="border border-[var(--border)] text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
                  onClick={cancelRecording}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="gap-2 border-0 bg-red-600 text-[var(--text)] hover:bg-red-500"
                  onClick={stopRecording}
                >
                  <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
                  Stop
                </Button>
              </div>
            </div>
          </div>
        )}
        {processing && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--overlay-scrim)] p-6 backdrop-blur-sm"
            role="alertdialog"
            aria-busy="true"
            aria-live="polite"
            aria-label="Transcribing and improving your notes"
          >
            <div className="max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--modal-surface)] px-8 py-6 text-center shadow-xl shadow-purple-950/40">
              <div
                className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-purple-400 border-t-transparent"
                aria-hidden
              />
              <p className="mt-4 text-sm font-medium text-[var(--text)]">Transcribing and improving your notes...</p>
              <p className="mt-1.5 text-xs text-[var(--muted)]">This can take a minute for long recordings.</p>
            </div>
          </div>
        )}
      </>,
      document.body
    );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={ACCEPT_AUDIO}
        onChange={onFileChange}
      />
      <div ref={menuRef} className={cn("relative", isHero && "w-full max-w-xs")}>
        {trigger}
        {menu}
      </div>
      {overlays}
    </>
  );
}
