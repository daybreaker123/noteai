import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { anthropicComplete, ANTHROPIC_MODEL_SONNET, hasAnthropicKey } from "@/lib/anthropic";
import { recordStudyActivity } from "@/lib/user-study-stats";
import { parseCitationsJson, citationsRecord, type SourceTypeId } from "@/lib/citation-types";

const FREE_CITATIONS_PER_MONTH = 5;
const MAX_SOURCE_CHARS = 16_000;

const SOURCE_LABELS: Record<SourceTypeId, string> = {
  website: "Website",
  book: "Book",
  journal: "Journal Article",
  youtube: "YouTube Video",
  podcast: "Podcast",
  newspaper: "Newspaper Article",
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function incrementCitations(userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const month = currentMonth();
  const { data: row } = await supabaseAdmin
    .from("ai_usage")
    .select("citations")
    .eq("user_id", userId)
    .eq("month", month)
    .single();
  const next = (row?.citations ?? 0) + 1;
  if (row) {
    await supabaseAdmin.from("ai_usage").update({ citations: next }).eq("user_id", userId).eq("month", month);
  } else {
    await supabaseAdmin.from("ai_usage").insert({
      user_id: userId,
      month,
      citations: 1,
    });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({
      plan: "pro",
      citations_used: 0,
      citations_limit: null as number | null,
      citations_remaining: null as number | null,
    });
  }

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", userId)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";

  const month = currentMonth();
  const { data: usage } = await supabaseAdmin
    .from("ai_usage")
    .select("citations")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();

  const used = usage?.citations ?? 0;
  if (plan === "pro") {
    return NextResponse.json({
      plan,
      citations_used: used,
      citations_limit: null,
      citations_remaining: null,
    });
  }

  return NextResponse.json({
    plan,
    citations_used: used,
    citations_limit: FREE_CITATIONS_PER_MONTH,
    citations_remaining: Math.max(0, FREE_CITATIONS_PER_MONTH - used),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const userId = session.user.id;
  const body = (await req.json()) as {
    source_input?: string;
    source_type?: string;
  };

  const sourceInput = typeof body.source_input === "string" ? body.source_input.trim() : "";
  const rawType = typeof body.source_type === "string" ? body.source_type.trim() : "";
  if (!sourceInput) {
    return NextResponse.json({ error: "Source information is required" }, { status: 400 });
  }
  if (sourceInput.length > MAX_SOURCE_CHARS) {
    return NextResponse.json(
      { error: `Source text is too long (max ${MAX_SOURCE_CHARS.toLocaleString()} characters)` },
      { status: 400 }
    );
  }

  const sourceType = rawType in SOURCE_LABELS ? (rawType as SourceTypeId) : "website";
  const typeLabel = SOURCE_LABELS[sourceType];

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", userId)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";

  const month = currentMonth();
  if (plan !== "pro") {
    const { data: usage } = await supabaseAdmin
      .from("ai_usage")
      .select("citations")
      .eq("user_id", userId)
      .eq("month", month)
      .maybeSingle();
    const used = usage?.citations ?? 0;
    if (used >= FREE_CITATIONS_PER_MONTH) {
      return NextResponse.json(
        {
          error: `You've used all ${FREE_CITATIONS_PER_MONTH} free citations this month — upgrade to Pro for unlimited`,
          code: "FREE_LIMIT_CITATIONS",
        },
        { status: 402 }
      );
    }
  }

  const userBlock = `Source type: ${typeLabel}\n\nSource details:\n${sourceInput}`;

  const system = `You are an expert bibliographer. Generate properly formatted academic bibliography entries for the source described by the user.

You must return ONLY a single valid JSON object with exactly these keys (all strings):
- "description": one clear sentence summarizing what the source is
- "apa": full citation in APA style (7th edition conventions)
- "mla": full citation in MLA style (9th edition conventions)
- "chicago": full citation in Chicago Notes-Bibliography style where applicable
- "harvard": full citation in Harvard referencing style

For each citation string, punctuation, element order, and italicization must be exactly correct for that style. Where italics are required, wrap the italicized segment in asterisks like *Title* so users can see emphasis in plain text.

Do not wrap the JSON in markdown code fences. No other text before or after the JSON.`;

  const userMessage = `Generate a properly formatted academic citation for the following source. Be precise with formatting — punctuation, italics notation, and order of elements must be exactly correct for each citation style. Also provide a brief one sentence description of what this source is about in the "description" field.

${userBlock}`;

  try {
    const text = await anthropicComplete(system, userMessage, {
      maxTokens: 4096,
      model: ANTHROPIC_MODEL_SONNET,
      usage: { userId },
    });

    const parsed = parseCitationsJson(text);
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not parse citation response. Try again with clearer source details." },
        { status: 502 }
      );
    }

    await incrementCitations(userId);
    await recordStudyActivity(userId);

    const { data: after } = await supabaseAdmin
      .from("ai_usage")
      .select("citations")
      .eq("user_id", userId)
      .eq("month", month)
      .maybeSingle();
    const usedAfter = after?.citations ?? 0;

    return NextResponse.json({
      plan,
      description: parsed.description,
      citations: citationsRecord(parsed),
      citations_used: usedAfter,
      citations_limit: plan === "pro" ? null : FREE_CITATIONS_PER_MONTH,
      citations_remaining:
        plan === "pro" ? null : Math.max(0, FREE_CITATIONS_PER_MONTH - usedAfter),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Citation generation failed" },
      { status: 502 }
    );
  }
}
