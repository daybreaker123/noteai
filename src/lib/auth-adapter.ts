import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import type { PrismaClient } from "@prisma/client";
import { AccountNotLinkedError } from "@/lib/auth-account-not-linked-error";
import { getSessionUserFromJwt } from "@/lib/auth-jwt";
import { decodeGoogleIdTokenPayload } from "@/lib/google-id-token";

const LOG = "[auth][google-oauth]";

/**
 * Wraps PrismaAdapter to:
 * - Log Google OAuth adapter steps (account lookup, user create, link).
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
      const u = (await base.getUserByAccount?.(providerAccount)) ?? null;
      if (providerAccount.provider === "google") {
        console.log(LOG, "getUserByAccount", {
          providerAccountId: providerAccount.providerAccountId,
          foundUserId: u?.id ?? null,
          email: u?.email ?? null,
        });
      }
      return u;
    },

    async createUser(data) {
      const u = (await base.createUser?.(data)) as AdapterUser;
      console.log(LOG, "createUser", {
        createdUserId: u?.id ?? null,
        email: u?.email ?? null,
      });
      return u;
    },

    async linkAccount(data) {
      const isGoogle = data.provider === "google";

      if (isGoogle) {
        console.log(LOG, "linkAccount (incoming)", {
          providerAccountId: data.providerAccountId,
          targetUserId: data.userId,
        });

        const existing = await client.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: data.provider,
              providerAccountId: data.providerAccountId,
            },
          },
        });
        if (existing) {
          console.log(LOG, "linkAccount: row already exists, delegating", {
            providerAccountId: data.providerAccountId,
            userId: existing.userId,
          });
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
            console.error(LOG, "linkAccount: Google sub !== providerAccountId", {
              googleSub,
              providerAccountId: data.providerAccountId,
            });
            throw new AccountNotLinkedError("Google account id mismatch.");
          }

          if (sessionEmail && googleEmail && sessionEmail !== googleEmail) {
            console.error(LOG, "linkAccount: REFUSE — JWT session user email !== Google id_token email", {
              sessionUserId: data.userId,
              sessionEmail,
              googleEmail,
              providerAccountId: data.providerAccountId,
            });
            throw new AccountNotLinkedError(
              "This Google account does not match your current Studara session. Sign out, then sign in with Google again."
            );
          }
        }
      }

      const result = await base.linkAccount?.(data);
      if (isGoogle) {
        console.log(LOG, "linkAccount (completed)", {
          providerAccountId: data.providerAccountId,
          userId: data.userId,
        });
      }
      return result as AdapterAccount | null | undefined;
    },
  };
}
