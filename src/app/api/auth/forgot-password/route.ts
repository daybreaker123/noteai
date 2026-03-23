import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset-crypto";
import { sendPasswordResetEmail } from "@/lib/email/send-transactional";

export const dynamic = "force-dynamic";

/** Same message whether or not the email exists (avoid account enumeration). */
const PUBLIC_MESSAGE =
  "If an account exists for that email with a password, we sent a reset link. Check your inbox (and spam).";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user?.password) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      const { raw, tokenHash } = createPasswordResetToken();
      await prisma.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const result = await sendPasswordResetEmail(email, raw);
      if (!result.ok) {
        console.error("[forgot-password] Resend failed:", result.error);
      }
    }

    return NextResponse.json({ ok: true, message: PUBLIC_MESSAGE });
  } catch (e) {
    console.error("[forgot-password] unexpected error", e);
    return NextResponse.json({ ok: true, message: PUBLIC_MESSAGE });
  }
}
