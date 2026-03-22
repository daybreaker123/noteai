import { cookies, headers } from "next/headers";
import { getToken } from "next-auth/jwt";

/**
 * Resolve the signed-in user from the JWT (avoids getServerSession / NextAuth assertConfig issues in some deployments).
 */
export async function getSessionUserFromJwt(): Promise<{ id: string; email: string } | null> {
  try {
    const cookieStore = await cookies();
    const headersList = await headers();
    const token = await getToken({
      req: {
        headers: Object.fromEntries(headersList.entries()),
        cookies: Object.fromEntries(cookieStore.getAll().map((c) => [c.name, c.value])),
      } as Parameters<typeof getToken>[0]["req"],
    });
    if (!token) {
      return null;
    }
    const rawId = (token.id as string | undefined) ?? (token.sub as string | undefined);
    if (!rawId) {
      return null;
    }
    // Must match Prisma User.id / Supabase user_id (trim avoids mismatch with stored rows)
    const id = String(rawId).trim();
    const email = typeof token.email === "string" ? token.email.trim() : "";
    return { id, email };
  } catch (err) {
    console.error("[auth-jwt] getToken failed:", err);
    return null;
  }
}
