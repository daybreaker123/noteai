import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAnthropicKey } from "@/lib/anthropic";
import { ANTHROPIC_MODEL_SONNET } from "@/lib/anthropic-models";
import { recordProApiSpendEstimate, resolveAnthropicModelForProUser } from "@/lib/pro-api-usage";
import { getUserPlanFromDb } from "@/lib/user-plan";
import { TUTOR_SYSTEM_PROMPT } from "@/lib/tutor-prompt";
import {
  buildTutorNotesContextDigest,
  TUTOR_NOTES_CONTEXT_INSTRUCTION,
} from "@/lib/tutor-notes-context";
import { generateTutorConversationTitleFromExchange } from "@/lib/tutor-conversation-title";
import { TUTOR_EXTRACTED_TEXT_MAX_CHARS } from "@/lib/tutor-chat-attachments";
import {
  buildTutorUserContentForModel,
  combineTutorAttachments,
  estimateBytesFromBase64,
  isAllowedImageMediaType,
  normalizeBase64Payload,
  TUTOR_MAX_IMAGE_BYTES,
  type StoredDocumentContextAttachment,
  type StoredImageAttachment,
} from "@/lib/tutor-anthropic-content";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export const dynamic = "force-dynamic";
const FREE_TUTOR_MESSAGES_PER_MONTH = 20;
const FREE_TUTOR_IMAGES_PER_MONTH = 5;
const MAX_CONTEXT_MESSAGES = 40;
/** User message text (incl. pasted document extracts) — stay below model context limits. */
const TUTOR_MAX_MESSAGE_CHARS = 200_000;

async function incrementTutorUsage(userId: string, includeImage: boolean): Promise<void> {
  if (!supabaseAdmin) return;
  const month = new Date().toISOString().slice(0, 7);
  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select("tutor_messages, tutor_images")
    .eq("user_id", userId)
    .eq("month", month)
    .single();
  const nextMsg = (row?.tutor_messages ?? 0) + 1;
  const nextImg = (row?.tutor_images ?? 0) + (includeImage ? 1 : 0);
  if (row) {
    await supabaseAdmin
      .from("ai_usage")
      .update({ tutor_messages: nextMsg, tutor_images: nextImg })
      .eq("user_id", userId)
      .eq("month", month);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      month,
      summarizations: 0,
      improvements: 0,
      tutor_messages: 1,
      tutor_images: includeImage ? 1 : 0,
    });
  }
}

async function decrementTutorUsage(userId: string, includeImage: boolean): Promise<void> {
  if (!supabaseAdmin) return;
  const month = new Date().toISOString().slice(0, 7);
  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select("tutor_messages, tutor_images")
    .eq("user_id", userId)
    .eq("month", month)
    .single();
  if (!row) return;
  const msg = Math.max(0, (row.tutor_messages ?? 0) - 1);
  const img = Math.max(0, (row.tutor_images ?? 0) - (includeImage ? 1 : 0));
  await supabaseAdmin
    .from("ai_usage")
    .update({ tutor_messages: msg, tutor_images: img })
    .eq("user_id", userId)
    .eq("month", month);
}

type IncomingBody = {
  conversationId?: string | null;
  message?: string;
  /** When true, fetch the user’s notes from Supabase and append as system context for this request. */
  useMyNotes?: boolean;
  image?: {
    mediaType?: string;
    data?: string;
  } | null;
  /** PDF/DOCX extract — stored in attachments; visible user message stays `message` only. */
  documentContext?: {
    fileName?: string;
    displayType?: string;
    text?: string;
  } | null;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey() || !ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured. Add ANTHROPIC_API_KEY to your environment." }, { status: 503 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = (await req.json()) as IncomingBody;
  const useMyNotes = body.useMyNotes === true;
  const rawMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (rawMessage.length > TUTOR_MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message too long (max ${TUTOR_MAX_MESSAGE_CHARS.toLocaleString()} characters).` },
      { status: 400 }
    );
  }
  let imagePayload: StoredImageAttachment[] | null = null;
  let documentAttachment: StoredDocumentContextAttachment | null = null;

  const doc = body.documentContext;
  if (doc?.text != null && String(doc.text).trim()) {
    let docText = String(doc.text).trim();
    if (docText.length > TUTOR_EXTRACTED_TEXT_MAX_CHARS) {
      return NextResponse.json(
        { error: `Attached document text too long (max ${TUTOR_EXTRACTED_TEXT_MAX_CHARS.toLocaleString()} characters).` },
        { status: 400 }
      );
    }
    const fileName = (doc.fileName?.trim() || "document").slice(0, 240);
    const displayType = (doc.displayType?.trim() || "Document").slice(0, 40);
    documentAttachment = {
      type: "document_context",
      file_name: fileName,
      display_type: displayType,
      text: docText,
    };
    if (rawMessage.length + docText.length > TUTOR_MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Message plus attachment exceed limit (max ${TUTOR_MAX_MESSAGE_CHARS.toLocaleString()} characters).` },
        { status: 400 }
      );
    }
  }

  if (body.image?.data) {
    const normalized = normalizeBase64Payload(body.image.data, body.image.mediaType);
    if ("error" in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    if (!isAllowedImageMediaType(normalized.mediaType)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use JPEG, PNG, GIF, or WebP." },
        { status: 400 }
      );
    }
    const bytes = estimateBytesFromBase64(normalized.data);
    if (bytes > TUTOR_MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `Image too large (max ${TUTOR_MAX_IMAGE_BYTES / (1024 * 1024)}MB after encoding).` },
        { status: 400 }
      );
    }
    imagePayload = [{ type: "image", media_type: normalized.mediaType, data: normalized.data }];
  }

  const visibleContent = rawMessage;
  if (!visibleContent && !imagePayload?.length && !documentAttachment) {
    return NextResponse.json({ error: "Enter a message or attach a file." }, { status: 400 });
  }

  const plan = await getUserPlanFromDb(userId);

  const month = new Date().toISOString().slice(0, 7);
  if (plan !== "pro") {
    const { data: usage } = await supabaseAdmin
      .from("ai_usage")
      .select("tutor_messages, tutor_images")
      .eq("user_id", userId)
      .eq("month", month)
      .single();
    const usedMsg = usage?.tutor_messages ?? 0;
    if (usedMsg >= FREE_TUTOR_MESSAGES_PER_MONTH) {
      return NextResponse.json(
        {
          error:
            "You've used all 20 free AI Tutor messages this month — upgrade to Pro for unlimited tutoring.",
          code: "FREE_LIMIT_TUTOR",
        },
        { status: 402 }
      );
    }
    if (imagePayload?.length) {
      const usedImg = usage?.tutor_images ?? 0;
      if (usedImg >= FREE_TUTOR_IMAGES_PER_MONTH) {
        return NextResponse.json(
          {
            error:
              "You've used all 5 free image uploads this month — upgrade to Pro for unlimited image uploads.",
            code: "FREE_LIMIT_TUTOR_IMAGES",
          },
          { status: 402 }
        );
      }
    }
  }

  let conversationId = body.conversationId?.trim() || null;

  if (!conversationId) {
    const conversationInsert = { user_id: userId, title: "New chat" };
    console.log("[tutor/chat] tutor_conversations insert (new thread)", {
      table: "tutor_conversations",
      payload: conversationInsert,
      nullFields: Object.fromEntries(
        Object.entries(conversationInsert).filter(([, v]) => v === null || v === undefined)
      ),
    });
    const { data: created, error: createErr } = await supabaseAdmin
      .from("tutor_conversations")
      .insert(conversationInsert)
      .select("id, title")
      .single();
    if (createErr || !created) {
      return NextResponse.json({ error: createErr?.message ?? "Failed to create conversation" }, { status: 500 });
    }
    conversationId = created.id;
  } else {
    const { data: conv, error: convErr } = await supabaseAdmin
      .from("tutor_conversations")
      .select("id, user_id, title")
      .eq("id", conversationId)
      .single();
    if (convErr || !conv || conv.user_id !== userId) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
  }

  const combinedAttachments = combineTutorAttachments(imagePayload, documentAttachment);

  const userMessagePayload: {
    conversation_id: string;
    user_id: string;
    role: "user";
    content: string;
    attachments?: ReturnType<typeof combineTutorAttachments>;
  } = {
    conversation_id: conversationId,
    user_id: userId,
    role: "user",
    content: visibleContent,
    attachments: combinedAttachments ?? undefined,
  };

  console.log("[tutor/chat] tutor_messages insert (user)", {
    table: "tutor_messages",
    payload: {
      ...userMessagePayload,
      content:
        visibleContent.length > 0
          ? `${visibleContent.slice(0, 200)}${visibleContent.length > 200 ? "…" : ""}`
          : "[no visible text — attachment only]",
      attachments: userMessagePayload.attachments ? "[present]" : undefined,
    },
    nullFields: Object.fromEntries(
      Object.entries(userMessagePayload).filter(([, v]) => v === null || v === undefined)
    ),
  });

  const { error: userMsgErr } = await supabaseAdmin.from("tutor_messages").insert(userMessagePayload);
  if (userMsgErr) {
    return NextResponse.json({ error: userMsgErr.message }, { status: 500 });
  }

  /** Keep sidebar order correct (most recently messaged first) even if DB triggers are missing. */
  const { error: touchUserErr } = await supabaseAdmin
    .from("tutor_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (touchUserErr) {
    console.warn("[tutor/chat] tutor_conversations updated_at (after user message) failed", touchUserErr.message);
  }

  const hadImage = !!imagePayload?.length;
  if (plan !== "pro") {
    await incrementTutorUsage(userId, hadImage);
  }

  const { data: historyRows } = await supabaseAdmin
    .from("tutor_messages")
    .select("role, content, attachments")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MAX_CONTEXT_MESSAGES);

  const history = (historyRows ?? []).reverse().filter((m) => m.role === "user" || m.role === "assistant");

  const anthropicMessages = history.map((m) => {
    if (m.role === "assistant") {
      return { role: "assistant" as const, content: m.content };
    }
    const userContent = buildTutorUserContentForModel(
      m.content ?? "",
      m.attachments,
      TUTOR_EXTRACTED_TEXT_MAX_CHARS
    );
    return { role: "user" as const, content: userContent };
  });

  let fullAssistant = "";

  const resolved = await resolveAnthropicModelForProUser(userId, ANTHROPIC_MODEL_SONNET, "stream");
  const tutorModel = resolved.model;
  const tutorEstimateCents = resolved.estimateCents;

  let systemPrompt = TUTOR_SYSTEM_PROMPT;
  if (useMyNotes) {
    const digest = await buildTutorNotesContextDigest(supabaseAdmin, userId);
    const notesBody = digest.trim()
      ? digest
      : "(The user has no saved notes with text content yet.)";
    systemPrompt = `${TUTOR_SYSTEM_PROMPT}

---

${TUTOR_NOTES_CONTEXT_INSTRUCTION}

## User's personal notes

${notesBody}`;
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: tutorModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    if (plan !== "pro") await decrementTutorUsage(userId, hadImage);
    const err = await upstream.text();
    return NextResponse.json({ error: err || "Tutor request failed" }, { status: 502 });
  }

  const reader = upstream.body?.getReader();
  if (!reader) {
    if (plan !== "pro") await decrementTutorUsage(userId, hadImage);
    return NextResponse.json({ error: "No response body" }, { status: 502 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`));
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          for (const raw of lines) {
            const line = raw.replace(/^\s+/, "");
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as {
                type?: string;
                delta?: { type?: string; text?: string };
              };
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta" &&
                parsed.delta?.text
              ) {
                fullAssistant += parsed.delta.text;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`)
                );
              }
            } catch {
              // skip malformed
            }
          }
        }
        if (fullAssistant.trim() && supabaseAdmin) {
          const assistantPayload = {
            conversation_id: conversationId as string,
            user_id: userId,
            role: "assistant" as const,
            content: fullAssistant,
          };
          console.log("[tutor/chat] tutor_messages insert (assistant)", {
            table: "tutor_messages",
            payload: {
              ...assistantPayload,
              content: `${fullAssistant.slice(0, 200)}${fullAssistant.length > 200 ? "…" : ""}`,
              contentLength: fullAssistant.length,
            },
            nullFields: Object.fromEntries(
              Object.entries(assistantPayload).filter(([, v]) => v === null || v === undefined)
            ),
          });
          const { error: asstErr } = await supabaseAdmin.from("tutor_messages").insert(assistantPayload);
          if (asstErr) {
            console.error("tutor assistant save failed", asstErr);
          } else {
            const { error: touchAsstErr } = await supabaseAdmin
              .from("tutor_conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", conversationId as string)
              .eq("user_id", userId);
            if (touchAsstErr) {
              console.warn(
                "[tutor/chat] tutor_conversations updated_at (after assistant message) failed",
                touchAsstErr.message
              );
            }
            const { count: msgCount } = await supabaseAdmin
              .from("tutor_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", conversationId as string);
            if (msgCount === 2) {
              const { data: firstUserRow } = await supabaseAdmin
                .from("tutor_messages")
                .select("content, attachments")
                .eq("conversation_id", conversationId as string)
                .eq("role", "user")
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();
              const generatedTitle = await generateTutorConversationTitleFromExchange({
                firstUserContent: firstUserRow?.content ?? "",
                firstUserAttachments: firstUserRow?.attachments,
                firstAssistantResponse: fullAssistant.trim(),
                userId,
              });
              if (generatedTitle) {
                await supabaseAdmin
                  .from("tutor_conversations")
                  .update({ title: generatedTitle })
                  .eq("id", conversationId as string);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      conversationId,
                      conversationTitle: generatedTitle,
                    })}\n\n`
                  )
                );
              }
            }
          }
        }
        await recordProApiSpendEstimate(userId, tutorEstimateCents);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        failed = true;
        try {
          controller.error(e);
        } catch {
          /* already closed */
        }
      } finally {
        if (failed && plan !== "pro") {
          await decrementTutorUsage(userId, hadImage);
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
