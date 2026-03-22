import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

/** Trim so pasted env values with accidental whitespace still work. */
const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const googleConfigured = Boolean(googleId && googleSecret);

/**
 * Google Cloud Console → OAuth client → Authorized redirect URIs must include exactly:
 *   `${NEXTAUTH_URL}/api/auth/callback/google`
 * e.g. http://localhost:3000/api/auth/callback/google
 */

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET?.trim(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleConfigured
      ? [
          // Link Google to an existing user with the same verified email (e.g. password signup first).
          // Set on the provider object and in GoogleProvider() options so merge keeps it on InternalProvider.
          {
            ...GoogleProvider({
              clientId: googleId!,
              clientSecret: googleSecret!,
              allowDangerousEmailAccountLinking: true,
            }),
            allowDangerousEmailAccountLinking: true,
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
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
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
  callbacks: {
    async redirect({ url, baseUrl }) {
      const baseNorm = baseUrl.replace(/\/$/, "");
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
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
};
