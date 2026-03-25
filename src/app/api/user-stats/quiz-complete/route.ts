import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recordQuizCompletion, streakJson } from "@/lib/user-study-stats";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { study_set_id?: string | null } | null;
  const studySetId =
    body?.study_set_id != null && typeof body.study_set_id === "string" ? body.study_set_id.trim() : null;

  const result = await recordQuizCompletion(session.user.id, studySetId);
  return NextResponse.json({ ok: true, ...streakJson(result) });
}
