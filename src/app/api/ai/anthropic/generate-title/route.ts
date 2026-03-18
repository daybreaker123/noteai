import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { anthropicComplete, hasAnthropicKey } from "@/lib/anthropic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured. Add ANTHROPIC_API_KEY to your environment." }, { status: 503 });
  }

  const { content } = (await req.json()) as { content?: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const system = `Suggest a concise, descriptive title (3-8 words) for this note. Return only the title, no quotes or punctuation.`;
  const userMessage = content.slice(0, 8000);

  try {
    const text = await anthropicComplete(system, userMessage, { maxTokens: 64 });
    const title = text.trim().replace(/^["']|["']$/g, "");
    return NextResponse.json({ title: title || "Untitled" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Title generation failed" },
      { status: 502 }
    );
  }
}
