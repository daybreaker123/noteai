import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { anthropicComplete, ANTHROPIC_MODEL_HAIKU, hasAnthropicKey } from "@/lib/anthropic";
import { sanitizeGeneratedNoteTitle } from "@/lib/sanitize-note-title";
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

  const system = `Suggest a concise, descriptive title (3-8 words) for this note. Return only the title as plain text — no markdown (no #, *, _, \`, quotes around the title, or list markers).`;
  const userMessage = content.slice(0, 8000);

  try {
    const text = await anthropicComplete(system, userMessage, {
      maxTokens: 64,
      model: ANTHROPIC_MODEL_HAIKU,
      usage: { userId: session.user.id },
    });
    const title = sanitizeGeneratedNoteTitle(text);
    const streak = await recordStudyActivity(session.user.id);
    return NextResponse.json({ title, ...streakJson(streak) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Title generation failed" },
      { status: 502 }
    );
  }
}
