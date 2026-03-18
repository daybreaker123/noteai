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

  const system = `Extract all action items and tasks from the following note. Return them as a bullet list, one task per line. Use "- " for each bullet. Be thorough — include any to-dos, deadlines, or follow-ups mentioned. If there are no tasks, return "No tasks found."`;
  const userMessage = content.slice(0, 16000);

  try {
    const text = await anthropicComplete(system, userMessage, { maxTokens: 1024 });
    const tasks = text
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((t) => t.length > 0 && t !== "No tasks found.");
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Task extraction failed" },
      { status: 502 }
    );
  }
}
