"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui";
import { StudaraWordmark } from "@/components/studara-wordmark";
import { cn } from "@/lib/cn";
import { TutorImageLightbox } from "@/components/tutor-image-lightbox";
import { TutorMarkdown } from "@/components/tutor-markdown";
import { SignoutButton } from "@/components/signout-button";
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
  FileText,
  GraduationCap,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Settings,
  Sparkles,
  Trash2,
  UserCircle,
  X,
} from "lucide-react";

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

const TUTOR_ACTIVE_CONV_STORAGE_KEY = "studara-tutor-active-conversation-id";

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
  /** When true, user chose "New chat" — don't auto-select the latest conversation from the list. */
  const [pendingNewChat, setPendingNewChat] = React.useState(false);
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
    console.log("[tutor:conversations] fetch start", { silent: Boolean(opts?.silent) });
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
      console.log("[tutor:conversations] fetch ok", {
        count: list.length,
        firstIds: list.slice(0, 3).map((c) => c.id),
      });
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
        console.log("[tutor:conversations] loadingList -> false");
      }
    }
  }, []);

  const loadMessages = React.useCallback(async (conversationId: string, opts?: { silent?: boolean }) => {
    console.log("[tutor:messages] fetch start", { conversationId, silent: Boolean(opts?.silent) });
    if (!opts?.silent) {
      setLoadingMessages(true);
    }
    try {
      const res = await fetch(`/api/tutor/conversations/${conversationId}/messages`, tutorFetchInit);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn("[tutor:messages] fetch failed", {
          conversationId,
          status: res.status,
          bodyPreview: body.slice(0, 200),
        });
        lastMessagesLoadedForConversationRef.current = null;
        return;
      }
      const json = (await res.json()) as { messages?: ChatMessage[] };
      const rows = (json.messages ?? []) as ChatMessage[];
      console.log("[tutor:messages] fetch ok", { conversationId, messageCount: rows.length });
      setMessages(rows);
      lastMessagesLoadedForConversationRef.current = conversationId;
    } catch (e) {
      console.warn("[tutor:messages] fetch threw", { conversationId, error: e });
      lastMessagesLoadedForConversationRef.current = null;
    } finally {
      if (!opts?.silent) {
        setLoadingMessages(false);
      }
    }
  }, []);

  const showFreeUsage = planReady && plan === "free";

  React.useEffect(() => {
    console.log("[tutor:restore] mount bootstrap: loadUserPlan + loadConversations");
    void Promise.all([loadUserPlan(), loadConversations()]);
  }, [loadUserPlan, loadConversations]);

  /** After list loads, restore last-open thread (localStorage) or the most recent conversation, then fetch messages. */
  React.useEffect(() => {
    console.log("[tutor:restore] effect tick", {
      loadingList,
      conversationCount: conversations.length,
      activeConversationId,
      pendingNewChat,
      sending,
      lastLoadedConv: lastMessagesLoadedForConversationRef.current,
    });

    if (loadingList) {
      console.log("[tutor:restore] skip: conversation list still loading");
      return;
    }

    if (conversations.length === 0) {
      console.log("[tutor:restore] no conversations from API — clear thread ref");
      lastMessagesLoadedForConversationRef.current = null;
      if (!pendingNewChat && !activeConversationId && !sending) {
        setMessages([]);
      }
      return;
    }

    if (pendingNewChat) {
      console.log("[tutor:restore] skip: user started new chat (no auto-restore)");
      return;
    }

    const inList = (id: string | null): id is string =>
      Boolean(id && conversations.some((c) => c.id === id));

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(TUTOR_ACTIVE_CONV_STORAGE_KEY)?.trim() || null;
    } catch {
      /* private mode / SSR */
    }

    let targetId: string;

    if (inList(activeConversationId)) {
      targetId = activeConversationId;
      console.log("[tutor:restore] active conversation id is valid for this user", { targetId });
    } else {
      const fromStorage = saved && conversations.some((c) => c.id === saved) ? saved : null;
      targetId = fromStorage ?? conversations[0]!.id;
      console.log("[tutor:restore] pick conversation", {
        targetId,
        source: fromStorage ? "localStorage" : "most_recent_updated_at",
        savedInStorage: saved,
        savedWasValid: Boolean(fromStorage),
      });
      if (activeConversationId !== targetId) {
        setActiveConversationId(targetId);
      }
    }

    if (lastMessagesLoadedForConversationRef.current === targetId) {
      console.log("[tutor:restore] skip loadMessages: already loaded this conversation in session", {
        targetId,
      });
      return;
    }

    console.log("[tutor:restore] calling loadMessages", { targetId });
    void loadMessages(targetId);
  }, [loadingList, conversations, activeConversationId, pendingNewChat, loadMessages, sending]);

  /** Persist active thread so returning to /tutor reloads the same conversation from Supabase. */
  React.useEffect(() => {
    if (!activeConversationId || pendingNewChat) return;
    try {
      localStorage.setItem(TUTOR_ACTIVE_CONV_STORAGE_KEY, activeConversationId);
      console.log("[tutor:restore] persisted activeConversationId to localStorage", {
        activeConversationId,
      });
    } catch {
      /* ignore */
    }
  }, [activeConversationId, pendingNewChat]);

  const selectConversation = (id: string) => {
    if (id === activeConversationId) return;
    console.log("[tutor:restore] selectConversation — effect will loadMessages", { id });
    setPendingNewChat(false);
    /** Clear so restore effect always fetches thread for the newly selected id (avoids stale skip). */
    lastMessagesLoadedForConversationRef.current = null;
    setActiveConversationId(id);
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
        if (remaining.length > 0) {
          const pick = remaining[0]!.id;
          setActiveConversationId(pick);
          void loadMessages(pick);
        } else {
          setActiveConversationId(null);
          setMessages([]);
          try {
            localStorage.removeItem(TUTOR_ACTIVE_CONV_STORAGE_KEY);
          } catch {
            /* ignore */
          }
        }
      }
      setConversationToDelete(null);
    } finally {
      setDeletingConversation(false);
    }
  };

  const newChat = () => {
    console.log("[tutor:restore] newChat — clear active thread + message cache ref");
    setPendingNewChat(true);
    setActiveConversationId(null);
    lastMessagesLoadedForConversationRef.current = null;
    setMessages([]);
    setAwaitingTutorReply(false);
    try {
      localStorage.removeItem(TUTOR_ACTIVE_CONV_STORAGE_KEY);
    } catch {
      /* ignore */
    }
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
      setPendingNewChat(false);
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
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#0a0a0f] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/12 via-blue-500/8 to-fuchsia-500/8 blur-3xl" />
      </div>

      <header className="relative z-10 shrink-0 px-4 pb-0 pt-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/notes"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/5 hover:text-white"
            aria-label="Back to notes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-purple-500/25 to-blue-500/20">
              <GraduationCap className="h-4 w-4 text-purple-200/95" />
            </div>
            <h1 className="text-base font-semibold tracking-tight text-white sm:text-[1.05rem]">AI Tutor</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={newChat}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/55 transition hover:bg-white/8 hover:text-white"
              aria-label="New chat"
              title="New chat"
            >
              <Plus className="h-5 w-5" strokeWidth={2} />
            </button>
            <Link
              href="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/45 transition hover:bg-white/8 hover:text-white"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
          </div>
        </div>
        <div
          className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent"
          aria-hidden
        />
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <aside className="flex w-[15.5rem] shrink-0 flex-col border-r border-white/[0.08] bg-black/25 backdrop-blur-xl md:w-64">
          <div className="shrink-0 border-b border-white/[0.06] p-3">
            <button
              type="button"
              onClick={newChat}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 transition hover:from-purple-500 hover:to-blue-500"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New Chat
            </button>
          </div>
          <div className="tutor-sidebar-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {loadingList ? (
              <div className="flex justify-center py-4 text-white/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-2 text-xs text-white/40">No chats yet — start below.</p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id} className="flex items-stretch gap-0.5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "min-w-0 flex-1 truncate rounded-xl border border-transparent px-3 py-2.5 text-left text-sm transition",
                        c.id === activeConversationId
                          ? "border-purple-500/35 bg-gradient-to-r from-purple-500/15 to-blue-500/10 text-white shadow-sm shadow-purple-900/10"
                          : "text-white/65 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white"
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
                        "shrink-0 rounded-xl p-2 text-white/30 transition hover:bg-red-500/12 hover:text-red-300/95",
                        c.id === activeConversationId && "text-white/45"
                      )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0 border-t border-white/[0.06] p-2">
            <Link
              href="/profile"
              className="mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.05] hover:text-white"
            >
              <UserCircle className="h-4 w-4 shrink-0 opacity-70" />
              Profile
            </Link>
            <SignoutButton />
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
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-purple-400/70 bg-[#0a0a0f]/85 backdrop-blur-sm">
              <p className="rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm font-medium text-white">
                Drop image, PDF, or Word file to attach
              </p>
            </div>
          ) : null}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            {loadingMessages && messages.length === 0 && !sending ? (
              <div className="flex h-full items-center justify-center text-white/40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : messages.length === 0 && !sending && !awaitingTutorReply ? (
              <div className="flex min-h-[min(60vh,520px)] flex-col items-center justify-center px-4 text-center">
                <div className="mb-6 flex flex-col items-center gap-3">
                  <StudaraWordmark className="text-3xl sm:text-4xl" />
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/20 to-blue-500/15 shadow-lg shadow-purple-900/20">
                    <GraduationCap className="h-8 w-8 text-purple-200/90" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  What are you working on today?
                </h2>
                <p className="mt-2 max-w-md text-sm text-white/45">
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
                      className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white/80 backdrop-blur-sm transition hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white"
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
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-500/30 to-blue-600/30">
                        <GraduationCap className="h-4 w-4 text-emerald-200" />
                      </div>
                    ) : (
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-purple-500/45 to-blue-500/35 text-[0.65rem] font-semibold uppercase leading-none tracking-tight text-white shadow-sm"
                        aria-label="You"
                      >
                        {userChatInitials}
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[88%] rounded-[1.35rem] px-5 py-4 text-[0.9375rem] leading-relaxed shadow-sm",
                        m.role === "user"
                          ? "border border-white/10 bg-gradient-to-br from-purple-500/35 via-purple-500/22 to-blue-500/28 text-white shadow-purple-900/10"
                          : "border border-white/[0.08] bg-[#14141c]/95 text-white/[0.94] shadow-black/20"
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
                                className="max-h-56 max-w-full cursor-zoom-in rounded-lg border border-white/10 object-contain transition-opacity hover:opacity-95"
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
                                className="flex max-w-full items-center gap-2 rounded-lg border border-white/15 bg-black/20 px-3 py-2"
                              >
                                <FileText className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-white">{a.file_name}</p>
                                  <p className="text-xs text-white/45">{a.display_type ?? "Document"}</p>
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-500/30 to-blue-600/30">
                      <GraduationCap className="h-4 w-4 text-emerald-200" />
                    </div>
                    <div className="flex items-center gap-2 rounded-[1.35rem] border border-white/[0.08] bg-[#14141c]/95 px-5 py-4 text-sm text-white/45 shadow-sm">
                      <span className="flex gap-1">
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.3s]" />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.15s]" />
                        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" />
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
            className="shrink-0 border-t border-white/[0.06] bg-[#08080c]/85 px-4 py-4 shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150 sm:px-6 sm:py-5"
          >
            <div className="mx-auto max-w-3xl space-y-3">
              {extractingDocument ? (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/70">
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
                    className="max-h-24 max-w-[min(100%,280px)] cursor-zoom-in rounded-lg border border-white/15 object-contain transition-opacity hover:opacity-95"
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
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#1a1a24] text-white shadow hover:bg-white/10"
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {pendingAttachment?.kind === "document" ? (
                <div className="flex max-w-full items-center gap-3 rounded-xl border border-white/15 bg-white/5 py-2 pl-3 pr-2">
                  <FileText className="h-9 w-9 shrink-0 text-purple-300/90" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{pendingAttachment.fileName}</p>
                    <p className="text-xs text-white/50">{pendingAttachment.displayType} · text ready to send</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearPendingAttachment}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                    aria-label="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <div className="flex items-end gap-2 sm:gap-3">
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
                  className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/30 transition hover:bg-white/[0.06] hover:text-white/55 disabled:opacity-35"
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
                  placeholder="Message… paste images or attach files"
                  rows={2}
                  disabled={sending || extractingDocument}
                  className="min-h-[52px] flex-1 resize-none rounded-[1.75rem] border border-white/[0.1] bg-black/35 px-5 py-3.5 text-sm leading-relaxed text-white shadow-inner shadow-black/30 placeholder:text-white/32 transition focus:border-purple-500/55 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:shadow-[0_0_24px_rgba(168,85,247,0.14)] disabled:opacity-45"
                />
                <button
                  type="submit"
                  disabled={sending || extractingDocument || (!input.trim() && !pendingAttachment)}
                  className="mb-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 text-white shadow-lg shadow-purple-900/35 transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-35"
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Send className="h-5 w-5 translate-x-px text-white" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
            {showFreeUsage && tutorLimit != null && (
              <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-white/40">
                Free plan: {Math.max(0, tutorLimit - tutorUsed)} tutor messages left
                {tutorImagesLimit != null
                  ? ` · ${Math.max(0, tutorImagesLimit - tutorImagesUsed)} image uploads left`
                  : ""}{" "}
                this month.{" "}
                <Link href="/billing" className="font-medium text-purple-300 underline-offset-2 hover:underline">
                  Upgrade to Pro
                </Link>{" "}
                for unlimited tutoring and images.
              </p>
            )}
          </form>
        </div>
      </div>

      {conversationToDelete ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12121a] p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Delete this conversation?</h3>
            <p className="mt-2 line-clamp-2 text-sm text-white/60">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              {upgradeModal === "images" ? "Image upload limit reached" : "Monthly tutor limit reached"}
            </h3>
            <p className="mt-2 text-sm text-white/70">
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
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 text-sm font-semibold text-white transition hover:from-purple-500 hover:to-blue-500"
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
