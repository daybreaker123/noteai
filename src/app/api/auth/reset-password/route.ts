import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashPasswordResetToken } from "@/lib/password-reset-crypto";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LEN = 6;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LEN} characters` },
        { status: 400 }
      );
    }

    const tokenHash = hashPasswordResetToken(token);
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!row || row.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        {
          error:
            "This reset link is invalid or has expired. Request a new one from the login page.",
        },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { password: hashed },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset-password]", e);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
