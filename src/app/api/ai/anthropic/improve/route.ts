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

  const system = `You are an expert note-taker and tutor. Improve these student notes by:
1) Fixing any unclear or incomplete explanations and filling in gaps in understanding
2) Adding relevant context, examples, or detail that would help a student studying this topic
3) Correcting anything that seems factually uncertain (the user marked one item with ?? - address that)
4) Keeping the casual student voice but making it clearer and more complete
5) Formatting it cleanly without excessive markdown headers - use simple spacing and dashes, not ## headers and bold everywhere.

The result should feel like a smarter, more complete version of the original notes, not a corporate document. Return only the improved notes, no preamble.`;
  const userMessage = content.slice(0, 16000);

  try {
    const text = await anthropicComplete(system, userMessage, { maxTokens: 4000 });
    return NextResponse.json({ improved: text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Improvement failed" },
      { status: 502 }
    );
  }
}
