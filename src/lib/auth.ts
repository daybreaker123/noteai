import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { createStudaraAuthAdapter } from "./auth-adapter";
import { getNextAuthUrl } from "./auth-url";
import { sendWelcomeEmail } from "@/lib/email/send-transactional";

/** Trim so pasted env values with accidental whitespace still work. */
const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const googleConfigured = Boolean(googleId && googleSecret);

/**
 * Google Cloud Console → OAuth client → Authorized redirect URIs must include exactly:
 *   `${NEXTAUTH_URL}/api/auth/callback/google`
 * (Use your real deployment URL in production, e.g. https://app.example.com/api/auth/callback/google)
 */

const GOOGLE_OAUTH_LOG = "[auth][google-oauth]";

export const authOptions: NextAuthOptions = {
  adapter: createStudaraAuthAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET?.trim(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleConfigured
      ? [
          {
            ...GoogleProvider({
              clientId: googleId!,
              clientSecret: googleSecret!,
              // Must stay false: when true, a brand-new Google account whose email matches an existing
              // User row is merged into that user without verifying ownership — wrong for multi-tenant safety.
              allowDangerousEmailAccountLinking: false,
              // Always show the account picker so the browser’s active Google session doesn’t silently win.
              authorization: {
                params: {
                  prompt: "select_account",
                  scope: "openid email profile",
                },
              },
            }),
            allowDangerousEmailAccountLinking: false,
          },
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user?.password) return null;
        const ok = await compare(credentials.password, user.password);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  events: {
    createUser: async ({ user }) => {
      const email = user.email?.trim();
      if (email) {
        void sendWelcomeEmail(email, user.name ?? null);
      }
    },
  },
  callbacks: {
    /**
     * Runs after NextAuth looks up Account by (provider, providerAccountId), before the DB
     * user/session handler. Logs providerAccountId + email + whether a linked user already exists.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        if (!account.providerAccountId) {
          console.error(GOOGLE_OAUTH_LOG, "signIn: missing providerAccountId");
          return false;
        }
        const emailFromProfile =
          profile && typeof profile === "object" && "email" in profile
            ? String((profile as { email?: string }).email ?? "")
            : "";
        const email =
          emailFromProfile.trim().toLowerCase() ||
          (typeof user.email === "string" ? user.email.trim().toLowerCase() : "");

        const existing = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
          },
          include: { user: { select: { id: true, email: true } } },
        });

        console.log(GOOGLE_OAUTH_LOG, "signIn callback", {
          providerAccountId: account.providerAccountId,
          email: email || null,
          existingUserId: existing?.user?.id ?? null,
          /** `user` is the DB user if getUserByAccount matched, else OAuth profile-shaped user */
          signInPayloadUserId: "id" in user && typeof user.id === "string" ? user.id : null,
        });
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Prefer NEXTAUTH_URL so production (e.g. Vercel) never uses a mis-inferred http://localhost base.
      const baseNorm = (getNextAuthUrl() ?? baseUrl).replace(/\/$/, "");
      const baseOrigin = new URL(baseNorm).origin;
      // Relative URLs (e.g. /auth/callback?next=... after Google OAuth)
      if (url.startsWith("/")) return `${baseNorm}${url}`;
      try {
        const target = new URL(url);
        if (target.origin === baseOrigin) return url;
      } catch {
        /* ignore invalid */
      }
      return baseNorm;
    },
    async jwt({ token, user, account, profile, trigger, isNewUser }) {
      if (account?.provider === "google") {
        console.log(GOOGLE_OAUTH_LOG, "jwt callback", {
          trigger: trigger ?? null,
          isNewUser: isNewUser ?? null,
          providerAccountId: account.providerAccountId ?? null,
          profileEmail:
            profile && typeof profile === "object" && "email" in profile
              ? String((profile as { email?: string }).email ?? "")
              : null,
          userObjectId: user?.id ?? null,
          tokenSubBefore: token.sub ?? null,
        });
      }
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
};
