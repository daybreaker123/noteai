import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Canonical app user id from NextAuth — matches `session.user.id` everywhere
 * (notes, categories, Supabase `user_id`, etc.). Prefer this over decoding the JWT manually.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id || typeof id !== "string") {
    return null;
  }
  return id.trim();
}
