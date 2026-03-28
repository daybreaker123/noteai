import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }
  const { action, content } = (await req.json()) as {
    action?: string;
    content?: string;
  };
  if (!action || !content) {
    return NextResponse.json({ error: "action and content required" }, { status: 400 });
  }
  const prompts: Record<string, string> = {
    summarize:
      "Summarize the following note in 3-5 sentences. Be concise. " +
      "Do not use markdown formatting, hashtags for headers, or asterisks for bold/italic. " +
      "Return plain text with clean line breaks and dashes for bullet points only (- item).",
    improve: "Improve the clarity and structure of the following note. Keep the same tone and length.",
    title: "Generate a short, descriptive title (3-8 words) for this note. Return only the title, no quotes.",
    tags: "Suggest 3-5 relevant tags for this note. Return only comma-separated tags, lowercase.",
  };
  const system = prompts[action] ?? "Help with this note.";
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: content.slice(0, 12000) },
        ],
        max_tokens: 500,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: "AI request failed" },
        { status: 502 }
      );
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ result: text });
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 502 });
  }
}
