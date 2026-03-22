"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { cn } from "@/lib/cn";
import { TutorMarkdown } from "@/components/tutor-markdown";
import { SignoutButton } from "@/components/signout-button";
import {
  fileToImagePayloadFromFile,
  TUTOR_DEFAULT_IMAGE_PROMPT,
  type StoredImageAttachment,
} from "@/lib/tutor-anthropic-content";
import {
  ArrowLeft,
  GraduationCap,
  ImagePlus,
  Loader2,
  MessageCirclePlus,
  Send,
  Sparkles,
  UserCircle,
  X,
} from "lucide-react";

type Conversation = { id: string; title: string; updated_at: string; created_at: string };
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  attachments?: StoredImageAttachment[] | null;
};

export function TutorPage() {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState("");
  const [plan, setPlan] = React.useState<"free" | "pro">("free");
  const [tutorUsed, setTutorUsed] = React.useState(0);
  const [tutorLimit, setTutorLimit] = React.useState<number | null>(20);
  const [tutorImagesUsed, setTutorImagesUsed] = React.useState(0);
  const [tutorImagesLimit, setTutorImagesLimit] = React.useState<number | null>(null);
  const [upgradeModal, setUpgradeModal] = React.useState<null | "messages" | "images">(null);
  /** When true, user chose "New chat" — don't auto-select the latest conversation from the list. */
  const [pendingNewChat, setPendingNewChat] = React.useState(false);
  /** Pending image before send: preview URL must be revoked on clear/unmount */
  const [pendingImage, setPendingImage] = React.useState<{ file: File; preview: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    return () => {
      if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    };
  }, [pendingImage]);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, sending, scrollToBottom]);

  const loadConversations = React.useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/tutor/conversations");
      if (!res.ok) return;
      const json = (await res.json()) as {
        conversations?: Conversation[];
        plan?: string;
        tutorMessagesUsed?: number;
        tutorMessagesLimit?: number | null;
        tutorImagesUsed?: number;
        tutorImagesLimit?: number | null;
      };
      setConversations(json.conversations ?? []);
      setPlan(json.plan === "pro" ? "pro" : "free");
      setTutorUsed(json.tutorMessagesUsed ?? 0);
      setTutorLimit(json.tutorMessagesLimit ?? null);
      setTutorImagesUsed(json.tutorImagesUsed ?? 0);
      setTutorImagesLimit(json.tutorImagesLimit ?? null);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = React.useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/tutor/conversations/${conversationId}/messages`);
      if (!res.ok) return;
      const json = (await res.json()) as { messages?: ChatMessage[] };
      setMessages((json.messages ?? []) as ChatMessage[]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  React.useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  React.useEffect(() => {
    if (loadingList) return;
    if (conversations.length === 0) {
      if (!pendingNewChat) {
        setActiveConversationId(null);
        setMessages([]);
      }
      return;
    }
    if (pendingNewChat) return;
    if (!activeConversationId || !conversations.some((c) => c.id === activeConversationId)) {
      const first = conversations[0]!.id;
      setActiveConversationId(first);
      void loadMessages(first);
    }
  }, [loadingList, conversations, activeConversationId, pendingNewChat, loadMessages]);

  const selectConversation = (id: string) => {
    if (id === activeConversationId) return;
    setPendingNewChat(false);
    setActiveConversationId(id);
    void loadMessages(id);
  };

  const newChat = () => {
    setPendingNewChat(true);
    setActiveConversationId(null);
    setMessages([]);
    setStreamingText("");
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      plan === "free" &&
      tutorImagesLimit != null &&
      tutorImagesUsed >= tutorImagesLimit
    ) {
      alert(
        "You've used all 5 free image uploads this month — upgrade to Pro for unlimited image uploads."
      );
      return;
    }
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    const preview = URL.createObjectURL(file);
    setPendingImage({ file, preview });
  };

  const clearPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (sending || (!text && !pendingImage)) return;

    let imagePayload: { mediaType: string; data: string } | undefined;
    if (pendingImage) {
      const parsed = await fileToImagePayloadFromFile(pendingImage.file);
      if ("error" in parsed) {
        alert(parsed.error);
        return;
      }
      imagePayload = { mediaType: parsed.mediaType, data: parsed.data };
    }

    const messageText = text || (imagePayload ? TUTOR_DEFAULT_IMAGE_PROMPT : "");
    if (!messageText) return;

    setInput("");
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
    setSending(true);
    setStreamingText("");

    const optimisticAttachments: StoredImageAttachment[] | undefined = imagePayload
      ? [{ type: "image", media_type: imagePayload.mediaType, data: imagePayload.data }]
      : undefined;

    const optimisticUser: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
      attachments: optimisticAttachments,
    };
    setMessages((m) => [...m, optimisticUser]);

    try {
      const res = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: text || undefined,
          image: imagePayload
            ? { mediaType: imagePayload.mediaType, data: imagePayload.data }
            : undefined,
        }),
      });

      if (res.status === 402) {
        const json = (await res.json().catch(() => ({}))) as { code?: string };
        setMessages((m) => m.filter((x) => x.id !== optimisticUser.id));
        setInput(text);
        setUpgradeModal(json.code === "FREE_LIMIT_TUTOR_IMAGES" ? "images" : "messages");
        await loadConversations();
        return;
      }

      if (!res.ok) {
        const errText = await res.text();
        setMessages((m) => m.filter((x) => x.id !== optimisticUser.id));
        setInput(text);
        alert(errText || "Something went wrong");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((m) => m.filter((x) => x.id !== optimisticUser.id));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let convId: string | null = activeConversationId;
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as { text?: string; conversationId?: string };
              if (parsed.conversationId) {
                convId = parsed.conversationId;
                setActiveConversationId(parsed.conversationId);
              }
              if (parsed.text) {
                full += parsed.text;
                setStreamingText(full);
              }
            } catch {
              /* skip */
            }
          }
        }
      }

      if (buffer.trim()) {
        for (const line of buffer.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as { text?: string; conversationId?: string };
            if (parsed.conversationId) {
              convId = parsed.conversationId;
              setActiveConversationId(parsed.conversationId);
            }
            if (parsed.text) {
              full += parsed.text;
              setStreamingText(full);
            }
          } catch {
            /* skip */
          }
        }
      }

      setStreamingText("");
      setPendingNewChat(false);
      if (convId) {
        await loadMessages(convId);
        await loadConversations();
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimisticUser.id));
      setInput(text);
      // restore attachment UX not fully possible without re-picking file
    } finally {
      setSending(false);
    }
  };

  const showTyping = sending && !streamingText;

  return (
    <div className="flex h-dvh flex-col bg-[#0a0a0f] text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/notes"
            className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Notes
          </Link>
          <div className="hidden h-6 w-px bg-white/10 sm:block" />
          <div className="flex min-w-0 items-center gap-2">
            <StudaraWordmarkLink href="/notes" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">AI Tutor</h1>
              <p className="truncate text-xs text-white/50">Studara · 24/7 academic help</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {plan === "free" && tutorLimit != null && (
            <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 sm:inline">
              {tutorUsed} / {tutorLimit} msgs
              {tutorImagesLimit != null ? ` · ${tutorImagesUsed} / ${tutorImagesLimit} imgs` : ""}
            </span>
          )}
          {plan === "pro" && (
            <span className="hidden items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200 sm:flex">
              <Sparkles className="h-3 w-3" />
              Unlimited
            </span>
          )}
          <Link
            href="/billing"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/5 sm:text-sm"
          >
            Billing
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-white/10 bg-black/20 md:w-64">
          <div className="border-b border-white/10 p-2">
            <button
              type="button"
              onClick={newChat}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-white/80 transition hover:bg-white/5"
            >
              <MessageCirclePlus className="h-4 w-4" />
              New chat
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadingList ? (
              <div className="flex justify-center py-4 text-white/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-2 text-xs text-white/40">No chats yet — start below.</p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "w-full truncate rounded-lg px-2 py-2 text-left text-sm transition",
                        c.id === activeConversationId
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {c.title || "Chat"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-white/10 p-2">
            <Link
              href="/profile"
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              <UserCircle className="h-4 w-4" />
              Profile
            </Link>
            <SignoutButton />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
            {loadingMessages && messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-white/40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : messages.length === 0 && !sending ? (
              <div className="mx-auto max-w-xl pt-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/10">
                  <GraduationCap className="h-7 w-7 text-emerald-300" />
                </div>
                <h2 className="text-lg font-semibold text-white">What are you working on?</h2>
                <p className="mt-2 text-sm text-white/50">
                  Ask anything — concepts, homework, essays, or get quizzed. Attach a photo of notes or a textbook page
                  to ask about what you see. I&apos;ll help you understand, not just give answers.
                </p>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-4">
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
                      <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" aria-hidden />
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                        m.role === "user"
                          ? "bg-gradient-to-br from-purple-500/30 to-blue-500/25 text-white border border-white/10"
                          : "bg-white/5 text-white/95 border border-white/5"
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
                                className="max-h-56 max-w-full rounded-lg border border-white/10 object-contain"
                              />
                            ) : null
                          )}
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      ) : (
                        <TutorMarkdown content={m.content} />
                      )}
                    </div>
                  </div>
                ))}

                {streamingText ? (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-500/30 to-blue-600/30">
                      <GraduationCap className="h-4 w-4 text-emerald-200" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white/95">
                      <TutorMarkdown content={streamingText} />
                    </div>
                  </div>
                ) : null}

                {showTyping ? (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-500/30 to-blue-600/30">
                      <GraduationCap className="h-4 w-4 text-emerald-200" />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/50">
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
            className="shrink-0 border-t border-white/10 bg-[#0a0a0f]/95 p-3 backdrop-blur sm:p-4"
          >
            <div className="mx-auto max-w-3xl space-y-3">
              {pendingImage ? (
                <div className="relative inline-flex">
                  {/* eslint-disable-next-line @next/next/no-img-element -- object URL preview before send */}
                  <img
                    src={pendingImage.preview}
                    alt="Attachment preview"
                    className="max-h-24 max-w-[min(100%,280px)] rounded-lg border border-white/15 object-contain"
                  />
                  <button
                    type="button"
                    onClick={clearPendingImage}
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#1a1a24] text-white shadow hover:bg-white/10"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                  className="sr-only"
                  onChange={onPickImage}
                />
                <button
                  type="button"
                  disabled={
                    sending ||
                    (plan === "free" &&
                      tutorImagesLimit != null &&
                      tutorImagesUsed >= tutorImagesLimit)
                  }
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                  aria-label="Attach image"
                  title={
                    plan === "free" &&
                    tutorImagesLimit != null &&
                    tutorImagesUsed >= tutorImagesLimit
                      ? "Monthly free image limit reached — upgrade to Pro for unlimited uploads"
                      : "Attach image (JPG, PNG, GIF, WebP)"
                  }
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Ask a question, paste a problem, or attach a photo of homework…"
                  rows={2}
                  disabled={sending}
                  className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/30 disabled:opacity-50"
                />
                <Button
                  type="submit"
                  disabled={sending || (!input.trim() && !pendingImage)}
                  className="h-11 shrink-0 self-end rounded-xl px-4"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {plan === "free" && tutorLimit != null && (
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
    </div>
  );
}
