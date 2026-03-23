import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAnthropicKey } from "@/lib/anthropic";
import { ANTHROPIC_MODEL_SONNET } from "@/lib/anthropic-models";
import { recordProApiSpendEstimate, resolveAnthropicModelForProUser } from "@/lib/pro-api-usage";
import { TUTOR_SYSTEM_PROMPT } from "@/lib/tutor-prompt";
import {
  buildUserAnthropicContent,
  estimateBytesFromBase64,
  isAllowedImageMediaType,
  normalizeBase64Payload,
  parseAttachmentsFromDb,
  TUTOR_DEFAULT_IMAGE_PROMPT,
  TUTOR_MAX_IMAGE_BYTES,
  type AnthropicUserContent,
  type StoredImageAttachment,
} from "@/lib/tutor-anthropic-content";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const FREE_TUTOR_MESSAGES_PER_MONTH = 20;
const FREE_TUTOR_IMAGES_PER_MONTH = 5;
const MAX_CONTEXT_MESSAGES = 40;

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
  image?: {
    mediaType?: string;
    data?: string;
  } | null;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey() || !ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured. Add ANTHROPIC_API_KEY to your environment." }, { status: 503 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const userId = session.user.id;
  const body = (await req.json()) as IncomingBody;
  const rawMessage = body.message?.trim() ?? "";
  let imagePayload: StoredImageAttachment[] | null = null;

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

  const displayText = rawMessage || (imagePayload ? TUTOR_DEFAULT_IMAGE_PROMPT : "");
  if (!displayText) {
    return NextResponse.json({ error: "Enter a message or attach an image." }, { status: 400 });
  }

  let plan: "free" | "pro" = "free";
  const { data: planRow } = await supabaseAdmin.from("user_plans").select("plan").eq("user_id", userId).single();
  plan = planRow?.plan === "pro" ? "pro" : "free";

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
  const titleSeed = rawMessage || (imagePayload ? "Image" : displayText);

  if (!conversationId) {
    const title = titleSeed.slice(0, 80) + (titleSeed.length > 80 ? "…" : "");
    const conversationInsert = { user_id: userId, title };
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
    if (conv.title === "New chat") {
      const t = titleSeed.slice(0, 80) + (titleSeed.length > 80 ? "…" : "");
      await supabaseAdmin.from("tutor_conversations").update({ title: t }).eq("id", conversationId);
    }
  }

  const userMessagePayload: {
    conversation_id: string;
    user_id: string;
    role: "user";
    content: string;
    attachments?: StoredImageAttachment[] | null;
  } = {
    conversation_id: conversationId,
    user_id: userId,
    role: "user",
    content: displayText,
  };
  if (imagePayload?.length) {
    userMessagePayload.attachments = imagePayload;
  }

  console.log("[tutor/chat] tutor_messages insert (user)", {
    table: "tutor_messages",
    payload: {
      ...userMessagePayload,
      content: `${displayText.slice(0, 200)}${displayText.length > 200 ? "…" : ""}`,
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
    const imgs = parseAttachmentsFromDb(m.attachments);
    const userContent: AnthropicUserContent = buildUserAnthropicContent(m.content, imgs);
    return { role: "user" as const, content: userContent };
  });

  let fullAssistant = "";

  const resolved = await resolveAnthropicModelForProUser(userId, ANTHROPIC_MODEL_SONNET, "stream");
  const tutorModel = resolved.model;
  const tutorEstimateCents = resolved.estimateCents;

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
      system: TUTOR_SYSTEM_PROMPT,
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
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
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
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
