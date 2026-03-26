import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Mark guided onboarding finished (skip or finished all steps). Idempotent. */
export async function POST() {
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

  if (user.onboardingCompletedAt != null) {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
