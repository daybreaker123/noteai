import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { anthropicComplete, ANTHROPIC_MODEL_HAIKU, hasAnthropicKey } from "@/lib/anthropic";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";

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

  const system = `Suggest 3-5 relevant tags for this note. Return only comma-separated tags, lowercase, no numbers or special characters. Example: work, meeting, follow-up`;
  const userMessage = content.slice(0, 8000);

  try {
    const text = await anthropicComplete(system, userMessage, {
      maxTokens: 128,
      model: ANTHROPIC_MODEL_HAIKU,
      usage: { userId: session.user.id },
    });
    const tags = text
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
      .filter((t) => t.length > 0)
      .slice(0, 5);
    const streak = await recordStudyActivity(session.user.id);
    return NextResponse.json({ tags, ...streakJson(streak) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tag suggestion failed" },
      { status: 502 }
    );
  }
}
