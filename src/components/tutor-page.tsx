"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui";
import { StudaraWordmark, StudaraWordmarkLink } from "@/components/studara-wordmark";
import { cn } from "@/lib/cn";
import { captureAnalytics } from "@/lib/analytics";
import { TutorImageLightbox } from "@/components/tutor-image-lightbox";
import { TutorMarkdown } from "@/components/tutor-markdown";
import {
  fileToImagePayloadFromFile,
  type StoredImageAttachment,
  type TutorStoredAttachment,
} from "@/lib/tutor-anthropic-content";
import {
  classifyTutorFile,
  documentDisplayType,
  isVideoFile,
  TUTOR_DOCUMENT_MAX_BYTES,
  TUTOR_FILE_INPUT_ACCEPT,
} from "@/lib/tutor-chat-attachments";
import {
  ArrowLeft,
  FileStack,
  FileText,
  GraduationCap,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
  Menu,
} from "lucide-react";

const USE_MY_NOTES_STORAGE_KEY = "studara-tutor-use-my-notes";

type PendingImageAttachment = { kind: "image"; file: File; preview: string };
type PendingDocumentAttachment = {
  kind: "document";
  fileName: string;
  mimeType: string;
  displayType: "PDF" | "Word";
  extractedText: string;
};
type PendingAttachment = PendingImageAttachment | PendingDocumentAttachment;

/** Two-letter avatar for tutor chat (matches purple user bubble styling). */
function tutorChatUserInitials(name: string | null | undefined, email: string | null | undefined): string {
  const n = typeof name === "string" ? name.trim() : "";
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase() || "ME";
  }
  const e = typeof email === "string" ? email.trim() : "";
  if (e) {
    const local = e.split("@")[0] ?? e;
    return local.slice(0, 2).toUpperCase() || "ME";
  }
  return "ME";
}

/** Avoid stale RSC/router caches; always load fresh threads from Supabase. */
const tutorFetchInit: RequestInit = { cache: "no-store", credentials: "include" };

type Conversation = { id: string; title: string; updated_at: string; created_at: string };

/** Most recently updated conversations first (matches GET /api/tutor/conversations). */
function sortConversationsByRecent(list: Conversation[]): Conversation[] {
  return [...list].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  attachments?: TutorStoredAttachment[] | null;
};

export function TutorPage() {
  const { data: session } = useSession();
  const userChatInitials = React.useMemo(
    () => tutorChatUserInitials(session?.user?.name, session?.user?.email),
    [session?.user?.name, session?.user?.email]
  );

  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  /** True while the tutor reply is being generated (Option A: no token-by-token UI; show typing only). */
  const [awaitingTutorReply, setAwaitingTutorReply] = React.useState(false);
  const [plan, setPlan] = React.useState<"free" | "pro">("free");
  /** After first `/api/me/plan` load — avoids flashing free-tier limits before we know the real plan. */
  const [planReady, setPlanReady] = React.useState(false);
  const [tutorUsed, setTutorUsed] = React.useState(0);
  const [tutorLimit, setTutorLimit] = React.useState<number | null>(null);
  const [tutorImagesUsed, setTutorImagesUsed] = React.useState(0);
  const [tutorImagesLimit, setTutorImagesLimit] = React.useState<number | null>(null);
  const [upgradeModal, setUpgradeModal] = React.useState<null | "messages" | "images">(null);
  /** Confirmation dialog for deleting a conversation from the sidebar. */
  const [conversationToDelete, setConversationToDelete] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deletingConversation, setDeletingConversation] = React.useState(false);
  /** Single pending attachment (image with preview, or document with extracted text). */
  const [pendingAttachment, setPendingAttachment] = React.useState<PendingAttachment | null>(null);
  const [extractingDocument, setExtractingDocument] = React.useState(false);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const dragDepthRef = React.useRef(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  /** Set in `loadMessages` only after a successful HTTP response so we can re-fetch on remount / failed loads. */
  const lastMessagesLoadedForConversationRef = React.useRef<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = React.useState<string | null>(null);
  const [useMyNotes, setUseMyNotes] = React.useState(false);
  const [mobileTutorSidebarOpen, setMobileTutorSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    if (!mobileTutorSidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileTutorSidebarOpen]);

  React.useEffect(() => {
    try {
      setUseMyNotes(localStorage.getItem(USE_MY_NOTES_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleUseMyNotes = React.useCallback(() => {
    setUseMyNotes((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(USE_MY_NOTES_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const openImageLightbox = React.useCallback((src: string) => {
    if (src) setLightboxSrc(src);
  }, []);

  React.useEffect(() => {
    return () => {
      if (pendingAttachment?.kind === "image") {
        URL.revokeObjectURL(pendingAttachment.preview);
      }
    };
  }, [pendingAttachment]);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, awaitingTutorReply, sending, scrollToBottom]);

  /** Source of truth for subscription tier (matches Supabase `user_plans` + tutor API enforcement). */
  const loadUserPlan = React.useCallback(async () => {
    try {
      const res = await fetch("/api/me/plan", { cache: "no-store" });
      if (!res.ok) {
        return;
      }
      const json = (await res.json()) as { plan?: string };
      const p = json.plan === "pro" ? "pro" : "free";
      setPlan(p);
      if (p === "pro") {
        setTutorLimit(null);
        setTutorImagesLimit(null);
      }
    } catch {
      /* ignore */
    } finally {
      setPlanReady(true);
    }
  }, []);

  const loadConversations = React.useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoadingList(true);
    }
    try {
      const res = await fetch("/api/tutor/conversations", tutorFetchInit);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn("[tutor:conversations] fetch failed", {
          status: res.status,
          statusText: res.statusText,
          bodyPreview: body.slice(0, 200),
        });
        return;
      }
      const json = (await res.json()) as {
        conversations?: Conversation[];
        plan?: string;
        tutorMessagesUsed?: number;
        tutorMessagesLimit?: number | null;
        tutorImagesUsed?: number;
        tutorImagesLimit?: number | null;
      };
      const list = json.conversations ?? [];
      setConversations(sortConversationsByRecent(list));
      setTutorUsed(json.tutorMessagesUsed ?? 0);
      setTutorLimit(json.tutorMessagesLimit ?? null);
      setTutorImagesUsed(json.tutorImagesUsed ?? 0);
      setTutorImagesLimit(json.tutorImagesLimit ?? null);
    } catch (e) {
      console.warn("[tutor:conversations] fetch threw", e);
    } finally {
      if (!opts?.silent) {
        setLoadingList(false);
      }
    }
  }, []);

  const loadMessages = React.useCallback(async (conversationId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoadingMessages(true);
    }
    try {
      const res = await fetch(`/api/tutor/conversations/${conversationId}/messages`, tutorFetchInit);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn("[tutor:messages] fetch failed", {
          status: res.status,
          bodyPreview: body.slice(0, 200),
        });
        lastMessagesLoadedForConversationRef.current = null;
        return;
      }
      const json = (await res.json()) as { messages?: ChatMessage[] };
      const rows = (json.messages ?? []) as ChatMessage[];
      setMessages(rows);
      lastMessagesLoadedForConversationRef.current = conversationId;
    } catch (e) {
      console.warn("[tutor:messages] fetch threw", e);
      lastMessagesLoadedForConversationRef.current = null;
    } finally {
      if (!opts?.silent) {
        setLoadingMessages(false);
      }
    }
  }, []);

  const showFreeUsage = planReady && plan === "free";

  React.useEffect(() => {
    void Promise.all([loadUserPlan(), loadConversations()]);
  }, [loadUserPlan, loadConversations]);

  /** Legacy: we no longer restore last thread from localStorage — clear old key once. */
  React.useEffect(() => {
    try {
      localStorage.removeItem("studara-tutor-active-conversation-id");
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Opening /tutor always shows the empty “new chat” state — no auto-restore of the last thread.
   * Sidebar still lists conversations; user must click one (or send a message) to load a thread.
   */
  React.useEffect(() => {
    if (loadingList) return;
    if (conversations.length === 0) {
      lastMessagesLoadedForConversationRef.current = null;
      if (!activeConversationId && !sending) {
        setMessages([]);
      }
    }
  }, [loadingList, conversations.length, activeConversationId, sending]);

  const selectConversation = (id: string) => {
    if (id === activeConversationId) return;
    lastMessagesLoadedForConversationRef.current = null;
    setActiveConversationId(id);
    setMobileTutorSidebarOpen(false);
    void loadMessages(id);
  };

  const deleteConversation = async () => {
    if (!conversationToDelete) return;
    const { id } = conversationToDelete;
    setDeletingConversation(true);
    try {
      const res = await fetch(`/api/tutor/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        alert(text || "Could not delete conversation.");
        return;
      }
      const remaining = sortConversationsByRecent(conversations.filter((c) => c.id !== id));
      setConversations(remaining);
      if (activeConversationId === id) {
        lastMessagesLoadedForConversationRef.current = null;
        setActiveConversationId(null);
        setMessages([]);
      }
      setConversationToDelete(null);
    } finally {
      setDeletingConversation(false);
    }
  };

  const newChat = () => {
    setMobileTutorSidebarOpen(false);
    setActiveConversationId(null);
    lastMessagesLoadedForConversationRef.current = null;
    setMessages([]);
    setAwaitingTutorReply(false);
    if (pendingAttachment?.kind === "image") {
      URL.revokeObjectURL(pendingAttachment.preview);
    }
    setPendingAttachment(null);
    setExtractingDocument(false);
  };

  const clearPendingAttachment = React.useCallback(() => {
    setPendingAttachment((prev) => {
      if (prev?.kind === "image") {
        URL.revokeObjectURL(prev.preview);
      }
      return null;
    });
  }, []);

  const processSelectedFile = React.useCallback(
    async (file: File) => {
      if (isVideoFile(file)) {
        alert("Video files aren’t supported. Use images, PDF, or Word (.docx).");
        return;
      }

      const kind = classifyTutorFile(file);
      if (kind === "unsupported") {
        alert("Supported: images (JPG, PNG, GIF, WebP), PDF, or Word (.docx).");
        return;
      }

      if (kind === "image") {
        if (showFreeUsage && tutorImagesLimit != null && tutorImagesUsed >= tutorImagesLimit) {
          alert(
            "You've used all 5 free image uploads this month — upgrade to Pro for unlimited image uploads."
          );
          return;
        }
        const preview = URL.createObjectURL(file);
        setPendingAttachment((prev) => {
          if (prev?.kind === "image") URL.revokeObjectURL(prev.preview);
          return { kind: "image", file, preview };
        });
        return;
      }

      if (file.size > TUTOR_DOCUMENT_MAX_BYTES) {
        alert(`File too large (max ${Math.round(TUTOR_DOCUMENT_MAX_BYTES / (1024 * 1024))}MB).`);
        return;
      }

      setPendingAttachment((prev) => {
        if (prev?.kind === "image") URL.revokeObjectURL(prev.preview);
        return null;
      });
      setExtractingDocument(true);
      try {
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/tutor/extract-document", {
          method: "POST",
          body: fd,
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; text?: string; fileName?: string };
        if (!res.ok) {
          alert(json.error || "Could not read this document.");
          return;
        }
        const text = json.text?.trim();
        if (!text) {
          alert("No text could be extracted from this file.");
          return;
        }
        setPendingAttachment({
          kind: "document",
          fileName: json.fileName || file.name || "Document",
          mimeType: file.type || "application/octet-stream",
          displayType: documentDisplayType(file),
          extractedText: text,
        });
      } catch {
        alert("Failed to process the document. Try again.");
      } finally {
        setExtractingDocument(false);
      }
    },
    [showFreeUsage, tutorImagesLimit, tutorImagesUsed]
  );

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void processSelectedFile(file);
  };

  const onPasteInComposer = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void processSelectedFile(file);
        }
        return;
      }
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (sending || extractingDocument || (!text && !pendingAttachment)) return;

    const visibleContent = text;
    let imagePayload: { mediaType: string; data: string } | undefined;
    let documentContext:
      | { fileName: string; displayType: string; text: string }
      | undefined;
    let optimisticAttachments: StoredImageAttachment[] | undefined;
    let optimisticDocAttachment:
      | {
          type: "document_context";
          file_name: string;
          display_type: string;
          text: string;
        }
      | undefined;

    if (pendingAttachment?.kind === "image") {
      const parsed = await fileToImagePayloadFromFile(pendingAttachment.file);
      if ("error" in parsed) {
        alert(parsed.error);
        return;
      }
      imagePayload = { mediaType: parsed.mediaType, data: parsed.data };
      optimisticAttachments = [
        { type: "image", media_type: imagePayload.mediaType, data: imagePayload.data },
      ];
    } else if (pendingAttachment?.kind === "document") {
      documentContext = {
        fileName: pendingAttachment.fileName,
        displayType: pendingAttachment.displayType,
        text: pendingAttachment.extractedText,
      };
      optimisticDocAttachment = {
        type: "document_context",
        file_name: pendingAttachment.fileName,
        display_type: pendingAttachment.displayType,
        text: pendingAttachment.extractedText,
      };
    }

    const combinedOptimisticAttachments =
      optimisticAttachments || optimisticDocAttachment
        ? [...(optimisticAttachments ?? []), ...(optimisticDocAttachment ? [optimisticDocAttachment] : [])]
        : undefined;

    setInput("");
    if (pendingAttachment?.kind === "image") {
      URL.revokeObjectURL(pendingAttachment.preview);
    }
    setPendingAttachment(null);
    setSending(true);

    if (activeConversationId) {
      const bumpId = activeConversationId;
      const now = new Date().toISOString();
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === bumpId);
        if (idx < 0) return prev;
        const row = prev[idx]!;
        const rest = prev.filter((c) => c.id !== bumpId);
        return sortConversationsByRecent([{ ...row, updated_at: now }, ...rest]);
      });
    }

    const optimisticUser: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: visibleContent,
      created_at: new Date().toISOString(),
      attachments: combinedOptimisticAttachments,
    };
    setMessages((m) => [...m, optimisticUser]);
    setAwaitingTutorReply(true);

    try {
      const res = await fetch("/api/tutor/chat", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: visibleContent.length > 0 ? visibleContent : undefined,
          useMyNotes,
          image: imagePayload
            ? { mediaType: imagePayload.mediaType, data: imagePayload.data }
            : undefined,
          documentContext: documentContext ?? undefined,
        }),
      });

      if (res.status === 402) {
        const json = (await res.json().catch(() => ({}))) as { code?: string };
        setMessages((m) => m.filter((x) => x.id !== optimisticUser.id));
        setInput(text);
        setAwaitingTutorReply(false);
        setUpgradeModal(json.code === "FREE_LIMIT_TUTOR_IMAGES" ? "images" : "messages");
        await loadConversations({ silent: true });
        return;
      }

      if (!res.ok) {
        const errText = await res.text();
        setMessages((m) => m.filter((x) => x.id !== optimisticUser.id));
        setInput(text);
        setAwaitingTutorReply(false);
        alert(errText || "Something went wrong");
        return;
      }

      captureAnalytics("ai_tutor_message_sent", {
        use_my_notes: useMyNotes,
        has_image: Boolean(imagePayload),
        has_document: Boolean(documentContext),
      });

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((m) => m.filter((x) => x.id !== optimisticUser.id));
        setAwaitingTutorReply(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let convId: string | null = activeConversationId;
      let full = "";
      const TEMP_ASSISTANT_ID = "temp-assistant";

      const applySseLine = (rawLine: string) => {
        const line = rawLine.replace(/^\s+/, "");
        if (!line.startsWith("data: ")) return;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data) as {
            text?: string;
            conversationId?: string;
            conversationTitle?: string;
          };
          if (parsed.conversationId) {
            const id = parsed.conversationId;
            convId = id;
            setActiveConversationId(id);
            setConversations((prev) => {
              if (prev.some((c) => c.id === id)) return prev;
              const now = new Date().toISOString();
              const row: Conversation = {
                id,
                title: "New chat",
                updated_at: now,
                created_at: now,
              };
              return sortConversationsByRecent([row, ...prev]);
            });
          }
          if (parsed.conversationTitle && parsed.conversationId) {
            const id = parsed.conversationId;
            const t = parsed.conversationTitle.trim();
            if (t) {
              setConversations((prev) =>
                sortConversationsByRecent(
                  prev.map((c) =>
                    c.id === id ? { ...c, title: t, updated_at: new Date().toISOString() } : c
                  )
                )
              );
            }
          }
          if (parsed.text) {
            full += parsed.text;
          }
        } catch {
          /* skip */
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          applySseLine(line);
        }
      }

      // Option A: reveal the full assistant message in one update (no incremental/streaming UI).
      if (full.trim()) {
        const assistantMsg: ChatMessage = {
          id: TEMP_ASSISTANT_ID,
          role: "assistant",
          content: full,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => {
          const withoutStale = prev.filter((m) => m.id !== TEMP_ASSISTANT_ID);
          return [...withoutStale, assistantMsg];
        });
      }
      setAwaitingTutorReply(false);

      if (convId) {
        await loadMessages(convId, { silent: true });
        await loadConversations({ silent: true });
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimisticUser.id));
      setInput(text);
      setAwaitingTutorReply(false);
      // restore attachment UX not fully possible without re-picking file
    } finally {
      setSending(false);
      void loadUserPlan();
    }
  };

  const showTyping = awaitingTutorReply;

  const applySuggestion = React.useCallback((text: string) => {
    setInput(text);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  return (
    <div className="relative flex h-dvh max-w-[100vw] flex-col overflow-x-hidden overflow-y-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background: `linear-gradient(to right, var(--page-glow-from), var(--page-glow-via), var(--page-glow-to))`,
          }}
        />
      </div>

      <header className="relative z-10 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--header-bar)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-[2000px] items-center justify-between gap-3 px-3 sm:h-[3.25rem] sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-label="Open conversations"
              aria-expanded={mobileTutorSidebarOpen}
              onClick={() => setMobileTutorSidebarOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] transition hover:bg-[var(--btn-default-bg)] md:hidden touch-manipulation"
            >
              <Menu className="h-6 w-6" strokeWidth={2} aria-hidden />
            </button>
            <StudaraWordmarkLink
              href="/notes"
              linkClassName="shrink-0 touch-manipulation opacity-95 transition hover:opacity-100"
            />
            <span className="hidden h-5 w-px shrink-0 bg-[var(--divider-fade)] sm:block" aria-hidden />
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] shadow-sm shadow-[var(--tutor-header-icon-shadow)]"
                style={{
                  background: `linear-gradient(to bottom right, var(--header-icon-surface-from), var(--header-icon-surface-to))`,
                }}
              >
                <GraduationCap className="h-3.5 w-3.5 text-[var(--accent-icon)]" strokeWidth={2} />
              </div>
              <h1 className="truncate text-[0.9375rem] font-semibold tracking-tight text-[var(--text)] sm:text-base">
                AI Tutor
              </h1>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <p className="hidden shrink-0 items-center gap-1.5 text-right text-[11px] leading-tight text-[var(--faint)] sm:flex">
            <kbd className="rounded-md border border-[var(--border)] bg-[var(--hover-bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--muted)]">
              Enter
            </kbd>
            <span>to send</span>
            <span className="text-[var(--faint)]">·</span>
            <kbd className="rounded-md border border-[var(--border)] bg-[var(--hover-bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--muted)]">
              Shift
            </kbd>
            <span className="text-[var(--faint)]">+</span>
            <kbd className="rounded-md border border-[var(--border)] bg-[var(--hover-bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--muted)]">
              Enter
            </kbd>
            <span>new line</span>
          </p>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1">
        <div
          role="presentation"
          aria-hidden={!mobileTutorSidebarOpen}
          className={cn(
            "fixed inset-0 z-[35] bg-[var(--overlay-scrim)] backdrop-blur-sm transition-opacity duration-300 md:hidden",
            mobileTutorSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setMobileTutorSidebarOpen(false)}
        />
        <aside
          className={cn(
            "flex w-[min(17rem,92vw)] shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] backdrop-blur-xl md:w-72",
            "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:relative md:z-10 md:translate-x-0",
            mobileTutorSidebarOpen
              ? "translate-x-0 shadow-[var(--tutor-mobile-sidebar-shadow)]"
              : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="shrink-0 px-4 pb-3 pt-5">
            <button
              type="button"
              onClick={newChat}
              className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/85 to-blue-500/85 px-4 py-3 text-sm font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] transition duration-200 hover:from-purple-500 hover:to-blue-500"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New chat
            </button>
          </div>
          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-[var(--divider-fade)] to-transparent" />
          <div className="tutor-sidebar-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
            {loadingList ? (
              <div className="flex justify-center py-4 text-[var(--faint)]">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-2 text-xs text-[var(--faint)]">No chats yet — start below.</p>
            ) : (
              <ul className="space-y-1.5">
                {conversations.map((c) => (
                  <li key={c.id} className="flex items-stretch gap-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "min-h-11 min-w-0 flex-1 touch-manipulation truncate rounded-xl border border-transparent px-3 py-2.5 text-left text-sm transition duration-200",
                        c.id === activeConversationId
                          ? "border-[var(--tutor-sidebar-active-border)] bg-gradient-to-r from-[var(--tutor-sidebar-active-from)] to-[var(--tutor-sidebar-active-to)] text-[var(--text)] shadow-sm shadow-[0_1px_2px_var(--tutor-sidebar-active-shadow)]"
                          : "text-[var(--muted)] hover:border-[var(--sidebar-border)] hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)]"
                      )}
                    >
                      {c.title || "Chat"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${c.title || "chat"}`}
                      title="Delete conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConversationToDelete({ id: c.id, title: c.title || "Chat" });
                      }}
                      className={cn(
                        "flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-[var(--placeholder)] transition hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-fg)]",
                        c.id === activeConversationId && "text-[var(--muted)]"
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-[var(--sidebar-border)] bg-[var(--sidebar-footer-bg)] p-4 backdrop-blur-sm">
            <Link
              href="/notes"
              onClick={() => setMobileTutorSidebarOpen(false)}
              className="flex min-h-11 w-full touch-manipulation items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)]"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              Back to notes
            </Link>
          </div>
        </aside>

        <div
          className="relative flex min-w-0 flex-1 flex-col"
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;
            dragDepthRef.current += 1;
            setIsDraggingFile(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) setIsDraggingFile(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current = 0;
            setIsDraggingFile(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void processSelectedFile(f);
          }}
        >
          {isDraggingFile ? (
            <div className="studara-overlay-85 pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--tutor-dropzone-border)] backdrop-blur-sm">
              <p className="rounded-xl border border-[var(--border)] bg-[var(--chrome-50)] px-4 py-3 text-sm font-medium text-[var(--text)]">
                Drop image, PDF, or Word file to attach
              </p>
            </div>
          ) : null}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-8 md:pb-8 max-md:pb-[calc(13rem+env(safe-area-inset-bottom))]"
          >
            {loadingMessages && messages.length === 0 && !sending ? (
              <div className="flex h-full items-center justify-center text-[var(--faint)]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : messages.length === 0 && !sending && !awaitingTutorReply ? (
              <div className="flex min-h-[min(60vh,520px)] flex-col items-center justify-center px-4 text-center">
                <div className="mb-6 flex flex-col items-center gap-3">
                  <StudaraWordmark className="text-3xl sm:text-4xl" />
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] shadow-lg shadow-[var(--tutor-header-icon-shadow)]"
                    style={{
                      background: `linear-gradient(to bottom right, var(--header-icon-surface-from), var(--header-icon-surface-to))`,
                    }}
                  >
                    <GraduationCap className="h-8 w-8 text-[var(--accent-icon)]" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
                  What are you working on today?
                </h2>
                <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
                  Paste or drop images, PDFs, or Word files — or start from a suggestion below.
                </p>
                <div className="mt-8 flex max-w-lg flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center">
                  {(
                    [
                      "Help me understand a concept",
                      "Review my notes",
                      "Solve a problem",
                    ] as const
                  ).map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => applySuggestion(`${label} — `)}
                      className="rounded-full border border-[var(--border-subtle)] bg-[var(--input-bg)] px-4 py-2.5 text-sm text-[var(--text)] backdrop-blur-sm transition hover:border-[var(--tutor-input-hover-border)] hover:bg-[var(--tutor-input-hover-bg)] hover:text-[var(--text)]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-8">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}
                  >
                    {m.role === "assistant" ? (
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-gradient-to-br from-[var(--tutor-avatar-assistant-from)] to-[var(--tutor-avatar-assistant-to)]"
                      >
                        <GraduationCap className="h-4 w-4 text-[var(--tutor-avatar-assistant-icon)]" />
                      </div>
                    ) : (
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-gradient-to-br from-[var(--tutor-user-avatar-from)] to-[var(--tutor-user-avatar-to)] text-[0.65rem] font-semibold uppercase leading-none tracking-tight text-[var(--text)] shadow-sm"
                        aria-label="You"
                      >
                        {userChatInitials}
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[88%] rounded-[1.35rem] px-5 py-4 text-[0.9375rem] leading-relaxed shadow-sm",
                        m.role === "user"
                          ? "border border-[var(--border)] bg-gradient-to-br from-[var(--tutor-user-bubble-from)] via-[var(--tutor-user-bubble-mid)] to-[var(--tutor-user-bubble-to)] text-[var(--text)] shadow-[0_1px_2px_var(--tutor-user-bubble-shadow)]"
                          : "border border-[var(--border-subtle)] bg-[var(--surface-mid)] text-[var(--text)]/[0.94] shadow-[0_1px_2px_var(--tutor-assistant-bubble-shadow)]"
                      )}
                    >
                      {m.role === "user" ? (
                        <div className="space-y-2">
                          {m.attachments?.map((a, i) =>
                            a.type === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element -- dynamic base64 from tutor history
                              <img
                                key={i}
                                src={`data:${a.media_type};base64,${a.data}`}
                                alt=""
                                className="max-h-56 max-w-full cursor-zoom-in rounded-lg border border-[var(--border)] object-contain transition-opacity hover:opacity-95"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  openImageLightbox(`data:${a.media_type};base64,${a.data}`)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openImageLightbox(`data:${a.media_type};base64,${a.data}`);
                                  }
                                }}
                              />
                            ) : a.type === "document_context" ? (
                              <div
                                key={i}
                                className="flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--chrome-20)] px-3 py-2"
                              >
                                <FileText className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-[var(--text)]">{a.file_name}</p>
                                  <p className="text-xs text-[var(--muted)]">{a.display_type ?? "Document"}</p>
                                </div>
                              </div>
                            ) : null
                          )}
                          {m.content.trim() ? (
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          ) : null}
                        </div>
                      ) : (
                        <TutorMarkdown content={m.content} onImageClick={openImageLightbox} />
                      )}
                    </div>
                  </div>
                ))}

                {showTyping ? (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-gradient-to-br from-[var(--tutor-avatar-assistant-from)] to-[var(--tutor-avatar-assistant-to)]">
                      <GraduationCap className="h-4 w-4 text-[var(--tutor-avatar-assistant-icon)]" />
                    </div>
                    <div className="flex items-center gap-2 rounded-[1.35rem] border border-[var(--border-subtle)] bg-[var(--surface-mid)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
                      <span className="flex gap-1">
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tutor-typing-dot)] [animation-delay:-0.3s]" />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tutor-typing-dot)] [animation-delay:-0.15s]" />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--tutor-typing-dot)]" />
                      </span>
                      Tutor is typing…
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="shrink-0 border-t border-[var(--sidebar-border)] bg-[var(--footer-bar)] px-4 py-3 shadow-[var(--tutor-composer-footer-shadow)] backdrop-blur-xl backdrop-saturate-150 sm:px-6 sm:py-5 md:static max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={useMyNotes}
                  onClick={toggleUseMyNotes}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:text-[13px]",
                    useMyNotes
                      ? "border-[var(--tutor-sidebar-active-border)] bg-gradient-to-r from-[var(--tutor-sidebar-active-from)] to-[var(--tutor-sidebar-active-to)] text-[var(--text)] shadow-[var(--tutor-notes-toggle-shadow)] ring-1 ring-[var(--tutor-notes-toggle-ring)]"
                      : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)]"
                  )}
                >
                  <FileStack className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  Use My Notes
                </button>
                {useMyNotes ? (
                  <span className="text-[11px] leading-snug text-[var(--accent-fg)] sm:text-xs">
                    Your notes are included with each message you send.
                  </span>
                ) : (
                  <span className="text-[11px] leading-snug text-[var(--faint)] sm:text-xs">
                    Turn on to let the tutor use your saved notes as context.
                  </span>
                )}
              </div>
              {extractingDocument ? (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--muted)]">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  Extracting text from document…
                </div>
              ) : null}
              {pendingAttachment?.kind === "image" ? (
                <div className="relative inline-flex">
                  {/* eslint-disable-next-line @next/next/no-img-element -- object URL preview before send */}
                  <img
                    src={pendingAttachment.preview}
                    alt="Attachment preview"
                    className="max-h-24 max-w-[min(100%,280px)] cursor-zoom-in rounded-lg border border-[var(--border)] object-contain transition-opacity hover:opacity-95"
                    role="button"
                    tabIndex={0}
                    onClick={() => openImageLightbox(pendingAttachment.preview)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openImageLightbox(pendingAttachment.preview);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={clearPendingAttachment}
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-chip)] text-[var(--text)] shadow hover:bg-[var(--btn-default-bg)]"
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {pendingAttachment?.kind === "document" ? (
                <div className="flex max-w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] py-2 pl-3 pr-2">
                  <FileText className="h-9 w-9 shrink-0 text-[var(--accent-fg)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)]">{pendingAttachment.fileName}</p>
                    <p className="text-xs text-[var(--muted)]">{pendingAttachment.displayType} · text ready to send</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearPendingAttachment}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)]"
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <div className="flex items-end gap-0 rounded-full border border-[var(--border)] bg-[var(--chrome-40)] py-1.5 pl-2 pr-1.5 shadow-[inset_0_2px_8px_var(--shadow-composer-inset)] transition focus-within:border-[var(--focus-border-color)] focus-within:ring-2 focus-within:ring-[var(--focus-ring-color)]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={TUTOR_FILE_INPUT_ACCEPT}
                  className="sr-only"
                  onChange={onPickFile}
                />
                <button
                  type="button"
                  disabled={
                    sending ||
                    extractingDocument ||
                    (showFreeUsage &&
                      tutorImagesLimit != null &&
                      tutorImagesUsed >= tutorImagesLimit)
                  }
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--faint)] transition duration-200 hover:bg-[var(--badge-free-bg)] hover:text-[var(--muted)] disabled:opacity-35 sm:h-10 sm:w-10"
                  aria-label="Attach file"
                  title={
                    showFreeUsage &&
                    tutorImagesLimit != null &&
                    tutorImagesUsed >= tutorImagesLimit
                      ? "Monthly free image limit reached — upgrade to Pro for unlimited uploads"
                      : "Attach image, PDF, or Word (.docx)"
                  }
                >
                  <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </button>
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={onPasteInComposer}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Ask anything…"
                  rows={1}
                  disabled={sending || extractingDocument}
                  className="min-h-[44px] flex-1 resize-none border-0 bg-transparent py-2.5 pr-2 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--placeholder)] outline-none ring-0 disabled:opacity-45"
                />
                <button
                  type="submit"
                  disabled={sending || extractingDocument || (!input.trim() && !pendingAttachment)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 text-[var(--inverse-text)] shadow-[var(--tutor-send-btn-shadow)] transition duration-200 hover:brightness-110 disabled:pointer-events-none disabled:opacity-35"
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--inverse-text)]" />
                  ) : (
                    <Send className="h-5 w-5 translate-x-px text-[var(--inverse-text)]" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
            {showFreeUsage && tutorLimit != null && (
              <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-[var(--faint)]">
                Free plan: {Math.max(0, tutorLimit - tutorUsed)} tutor messages left
                {tutorImagesLimit != null
                  ? ` · ${Math.max(0, tutorImagesLimit - tutorImagesUsed)} image uploads left`
                  : ""}{" "}
                this month.{" "}
                <Link href="/billing" className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
                  Upgrade to Pro
                </Link>{" "}
                for unlimited tutoring and images.
              </p>
            )}
          </form>
        </div>
      </div>

      {conversationToDelete ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--scrim-heavy)] p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--modal-surface)] p-5 shadow-[var(--shadow-brand-lg)]">
            <h3 className="text-lg font-semibold text-[var(--text)]">Delete this conversation?</h3>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
              &ldquo;{conversationToDelete.title}&rdquo; and all messages will be removed. This cannot be undone.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={deletingConversation}
                onClick={() => setConversationToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={deletingConversation}
                onClick={() => void deleteConversation()}
              >
                {deletingConversation ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {upgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-heavy)] p-4">
          <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--modal-surface)] p-6 shadow-[var(--shadow-brand-lg)]">
            <h3 className="text-lg font-semibold text-[var(--text)]">
              {upgradeModal === "images" ? "Image upload limit reached" : "Monthly tutor limit reached"}
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {upgradeModal === "images" ? (
                <>
                  You&apos;ve used all 5 free image uploads this month — upgrade to Pro for unlimited image uploads.
                </>
              ) : (
                <>
                  You&apos;ve used all {tutorLimit} free AI Tutor messages this month. Upgrade to Pro for unlimited
                  24/7 tutoring and keep every conversation saved.
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/billing"
                onClick={() => setUpgradeModal(null)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 text-sm font-semibold text-[var(--inverse-text)] transition hover:from-purple-500 hover:to-blue-500"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade to Pro
              </Link>
              <Button type="button" variant="ghost" onClick={() => setUpgradeModal(null)}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}

      <TutorImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
