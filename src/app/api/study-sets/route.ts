import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { StudySetKind, StudySetSummary } from "@/lib/api-types";
import { studySetItemCount } from "@/lib/study-set-utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ sets: [] as StudySetSummary[] });
  }

  const { data, error } = await supabaseAdmin
    .from("study_sets")
    .select("id, title, kind, payload, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sets: StudySetSummary[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title ?? "Study set",
    kind: row.kind as StudySetKind,
    created_at: row.created_at ?? new Date().toISOString(),
    item_count: studySetItemCount(row.kind as StudySetKind, row.payload),
  }));

  return NextResponse.json({ sets });
}
