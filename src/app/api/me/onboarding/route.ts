import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingCompletedAt: true,
      onboardingPersona: true,
      onboardingSampleNoteId: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const needsOnboarding = user.onboardingCompletedAt == null;
  const resume =
    needsOnboarding && user.onboardingSampleNoteId
      ? {
          persona: user.onboardingPersona,
          sampleNoteId: user.onboardingSampleNoteId,
        }
      : null;

  return NextResponse.json({
    needsOnboarding,
    resume,
  });
}
