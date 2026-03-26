import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getOnboardingSampleNote,
  isOnboardingPersona,
  type OnboardingPersona,
} from "@/lib/onboarding-persona";

export const runtime = "nodejs";

const FREE_NOTE_LIMIT = 50;

/**
 * Save persona and create the interactive onboarding sample note (idempotent if note already exists).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as { persona?: string } | null;
  const raw = body?.persona?.trim() ?? "";
  if (!isOnboardingPersona(raw)) {
    return NextResponse.json({ error: "Invalid persona" }, { status: 400 });
  }
  const persona = raw as OnboardingPersona;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingCompletedAt: true,
      onboardingSampleNoteId: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.onboardingCompletedAt != null) {
    return NextResponse.json({ error: "Onboarding already completed" }, { status: 400 });
  }

  if (user.onboardingSampleNoteId) {
    const { data: note } = await supabaseAdmin
      .from("notes")
      .select("id, title, content")
      .eq("id", user.onboardingSampleNoteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (note?.id) {
      return NextResponse.json({
        ok: true,
        noteId: note.id,
        title: note.title ?? "",
        content: note.content ?? "",
        persona,
      });
    }
  }

  const { data: planRow } = await supabaseAdmin.from("user_plans").select("plan").eq("user_id", userId).single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";
  if (plan !== "pro") {
    const { count } = await supabaseAdmin
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= FREE_NOTE_LIMIT) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          onboardingPersona: persona,
          onboardingCompletedAt: new Date(),
        },
      });
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: "note_limit",
        noteId: null,
      });
    }
  }

  const { title, html } = getOnboardingSampleNote(persona);
  const { data: note, error: noteError } = await supabaseAdmin
    .from("notes")
    .insert({
      user_id: userId,
      category_id: null,
      title,
      content: html,
      pinned: false,
      tags: ["onboarding-demo"],
    })
    .select()
    .single();

  if (noteError || !note?.id) {
    console.error("[onboarding/start] note insert failed:", noteError);
    return NextResponse.json({ error: noteError?.message ?? "Failed to create note" }, { status: 500 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingPersona: persona,
      onboardingSampleNoteId: note.id,
    },
  });

  return NextResponse.json({
    ok: true,
    noteId: note.id,
    title: note.title ?? title,
    content: note.content ?? html,
    persona,
  });
}
