import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAnthropicKey } from "@/lib/anthropic";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey() || !ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  let plan: "free" | "pro" = "free";
  if (supabaseAdmin) {
    const { data: planRow } = await supabaseAdmin
      .from("user_plans")
      .select("plan")
      .eq("user_id", session.user.id)
      .single();
    plan = planRow?.plan === "pro" ? "pro" : "free";
  } else {
    plan = "pro";
  }

  if (plan !== "pro") {
    return NextResponse.json(
      {
        error: "AI chat is a Pro feature — upgrade to Pro to chat across all your notes",
        code: "PRO_REQUIRED_CHAT",
      },
      { status: 402 }
    );
  }

  const { message } = (await req.json()) as { message?: string };
  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  let context = "";
  if (supabaseAdmin) {
    const { data: notes } = await supabaseAdmin
      .from("notes")
      .select("id, title, content")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    context = (notes ?? [])
      .map((n) => `[${n.title}]\n${(n.content ?? "").slice(0, 800)}`)
      .join("\n\n---\n\n");
  }

  const system = `You are a helpful assistant. The user has access to their notes. Use the following notes as context to answer their question. When referencing information, cite the note title in parentheses, e.g. (from: Meeting Notes). Be concise and helpful.\n\nNOTES:\n${context.slice(0, 80000)}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: message }],
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: err || "Chat request failed" },
        { status: 502 }
      );
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No response body" }, { status: 502 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        let buffer = "";
        try {
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
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`)
                    );
                  }
                } catch {
                  // skip malformed
                }
              }
            }
          }
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat request failed" },
      { status: 502 }
    );
  }
}
