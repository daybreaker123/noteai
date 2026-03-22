import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const LOG = "[api/signup]";

function safeDbHost(): string {
  try {
    const u = process.env.DATABASE_URL;
    if (!u?.trim()) return "(DATABASE_URL missing)";
    const normalized = u.replace(/^postgresql:\/\//i, "http://").replace(/^postgres:\/\//i, "http://");
    return new URL(normalized).hostname;
  } catch {
    return "(could not parse DATABASE_URL)";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const { email: rawEmail, password, name } = body;

    if (!rawEmail || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Email and password (min 6 chars) required" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(rawEmail);
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const hashed = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name?.trim() ? name.trim() : null,
      },
    });

    console.info(`${LOG} user created`, { id: user.id, email: user.email, dbHost: safeDbHost() });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const stack = err.stack ?? "";

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`${LOG} Prisma known error`, {
        code: e.code,
        meta: e.meta,
        message: e.message,
        clientVersion: e.clientVersion,
        dbHost: safeDbHost(),
      });
    } else if (e instanceof Prisma.PrismaClientValidationError) {
      console.error(`${LOG} Prisma validation error`, {
        message: e.message,
        dbHost: safeDbHost(),
      });
    } else if (e instanceof Prisma.PrismaClientInitializationError) {
      console.error(`${LOG} Prisma init / connection error`, {
        message: e.message,
        errorCode: e.errorCode,
        dbHost: safeDbHost(),
      });
    } else if (e instanceof Prisma.PrismaClientUnknownRequestError) {
      console.error(`${LOG} Prisma unknown request error`, {
        message: e.message,
        clientVersion: e.clientVersion,
        dbHost: safeDbHost(),
      });
    } else if (e instanceof Prisma.PrismaClientRustPanicError) {
      console.error(`${LOG} Prisma engine panic`, { message: e.message, dbHost: safeDbHost() });
    } else {
      console.error(`${LOG} unexpected error`, {
        name: err.name,
        message: err.message,
        stack,
        dbHost: safeDbHost(),
      });
    }

    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: isDev ? err.message : "Signup failed",
        ...(isDev && { detail: stack.split("\n").slice(0, 5).join("\n") }),
      },
      { status: 500 }
    );
  }
}
