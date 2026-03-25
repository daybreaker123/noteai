import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { WELCOME_NOTE_HTML } from "@/lib/welcome-note-html";

export const runtime = "nodejs";

const WELCOME_TITLE = "Welcome to Studara";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingCompletedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    needsOnboarding: user.onboardingCompletedAt == null,
  });
}

/**
 * Mark onboarding done and create the sample welcome note (idempotent if already completed).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingCompletedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (existing.onboardingCompletedAt != null) {
    return NextResponse.json({ ok: true, alreadyCompleted: true, welcomeNoteId: null });
  }

  const { data: planRow } = await supabaseAdmin.from("user_plans").select("plan").eq("user_id", userId).single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";
  if (plan !== "pro") {
    const { count } = await supabaseAdmin
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= 50) {
      await prisma.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: new Date() },
      });
      return NextResponse.json({
        ok: true,
        welcomeNoteSkipped: true,
        reason: "note_limit",
        welcomeNoteId: null,
      });
    }
  }

  const { data: note, error: noteError } = await supabaseAdmin
    .from("notes")
    .insert({
      user_id: userId,
      category_id: null,
      title: WELCOME_TITLE,
      content: WELCOME_NOTE_HTML,
      pinned: true,
      tags: ["getting-started"],
    })
    .select()
    .single();

  if (noteError) {
    console.error("[onboarding] welcome note insert failed:", noteError);
    return NextResponse.json({ error: noteError.message }, { status: 500 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    alreadyCompleted: false,
    welcomeNoteId: note?.id ?? null,
  });
}
