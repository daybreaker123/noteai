import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";

/** Records one study day (e.g. ephemeral flashcards with no saved progress row). Idempotent per UTC day. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const streak = await recordStudyActivity(session.user.id);
  return NextResponse.json({ ok: true, ...streakJson(streak) });
}
