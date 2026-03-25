import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import type { PrismaClient } from "@prisma/client";
import { AccountNotLinkedError } from "@/lib/auth-account-not-linked-error";
import { getSessionUserFromJwt } from "@/lib/auth-jwt";
import { decodeGoogleIdTokenPayload } from "@/lib/google-id-token";

const LOG = "[auth][google-oauth]";

/**
 * Wraps PrismaAdapter to:
 * - Block NextAuth's "link new Google identity to existing JWT session user" path when the Google
 *   account email does not match that session user (prevents logging into the wrong Studara user).
 *
 * NextAuth's callback-handler links OAuth to the current JWT user when a session cookie exists.
 * That can attach Google account B to Studara user A if the cookie wasn't cleared. We refuse that
 * unless emails match (deliberate "connect Google" to the same email).
 */
export function createStudaraAuthAdapter(client: PrismaClient): Adapter {
  const base = PrismaAdapter(client);

  return {
    ...base,
    async getUserByAccount(providerAccount) {
      return (await base.getUserByAccount?.(providerAccount)) ?? null;
    },

    async createUser(data) {
      return (await base.createUser?.(data)) as AdapterUser;
    },

    async linkAccount(data) {
      const isGoogle = data.provider === "google";

      if (isGoogle) {
        const existing = await client.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: data.provider,
              providerAccountId: data.providerAccountId,
            },
          },
        });
        if (existing) {
          return base.linkAccount?.(data) as Promise<AdapterAccount | null | undefined>;
        }

        const jwtUser = await getSessionUserFromJwt();
        const dbUser = await client.user.findUnique({
          where: { id: data.userId },
          select: { email: true },
        });
        const sessionEmail = (dbUser?.email ?? jwtUser?.email)?.toLowerCase()?.trim() ?? "";

        if (jwtUser?.id === data.userId) {
          const payload = decodeGoogleIdTokenPayload(data.id_token);
          const googleSub = payload?.sub;
          const googleEmail = payload?.email?.toLowerCase()?.trim() ?? "";

          if (googleSub && googleSub !== data.providerAccountId) {
            console.error(LOG, "linkAccount: Google sub !== providerAccountId");
            throw new AccountNotLinkedError("Google account id mismatch.");
          }

          if (sessionEmail && googleEmail && sessionEmail !== googleEmail) {
            console.error(LOG, "linkAccount: REFUSE — session email does not match Google id_token email");
            throw new AccountNotLinkedError(
              "This Google account does not match your current Studara session. Sign out, then sign in with Google again."
            );
          }
        }
      }

      const result = await base.linkAccount?.(data);
      return result as AdapterAccount | null | undefined;
    },
  };
}
