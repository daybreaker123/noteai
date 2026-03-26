"use client";

import { useState, Suspense, useEffect } from "react";
import { getCsrfToken } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoginPanel } from "@/components/login-panel";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid email or password",
  OAuthSignin: "Could not start Google sign-in. Check NEXTAUTH_URL and Google OAuth settings.",
  OAuthCallback:
    "Google sign-in failed after redirect. In Google Cloud Console, add Authorized redirect URI: {your NEXTAUTH_URL}/api/auth/callback/google (must match exactly, including https).",
  OAuthAccountNotLinked:
    "This email is already used with another sign-in method. Log in with your password or link accounts in settings.",
  AccessDenied: "Access was denied.",
  Configuration:
    "Server auth misconfiguration. Ensure NEXTAUTH_SECRET, NEXTAUTH_URL, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET are set.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const targetUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  // Redirect via intermediate page so session cookie is established before middleware runs
  const callbackUrl = `/auth/callback?next=${encodeURIComponent(targetUrl)}`;
  const urlError = searchParams.get("error");
  const [error, setError] = useState(() =>
    urlError ? OAUTH_ERROR_MESSAGES[urlError] ?? `Sign-in error: ${urlError}` : ""
  );
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    getCsrfToken().then(setCsrfToken);
  }, []);

  useEffect(() => {
    if (!urlError) {
      setError("");
      return;
    }
    setError(
      OAUTH_ERROR_MESSAGES[urlError] ??
        (urlError === "CredentialsSignin" ? OAUTH_ERROR_MESSAGES.CredentialsSignin : `Sign-in error: ${urlError}`)
    );
  }, [urlError]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)?.value;
    if (!email || !password) {
      setError("Email and password required");
      return;
    }
    const { signIn } = await import("next-auth/react");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    if (res?.url) {
      await new Promise((r) => setTimeout(r, 100));
      window.location.assign(res.url);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle variant="icon" />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <StudaraWordmarkLink href="/" />
        </div>
        <LoginPanel
          onSubmit={handleSubmit}
          error={error}
          callbackUrl={callbackUrl}
          csrfToken={csrfToken}
          useFormPost={true}
        />
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Don&apos;t have an account?{" "}
          <Link href={`/signup?callbackUrl=${encodeURIComponent(targetUrl)}`} className="text-[var(--accent)] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Loading…</div>
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
