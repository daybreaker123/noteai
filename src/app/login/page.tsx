"use client";

import { useState, Suspense, useEffect } from "react";
import { getCsrfToken } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LoginPanel } from "@/components/login-panel";

function LoginContent() {
  const searchParams = useSearchParams();
  const targetUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  // Redirect via intermediate page so session cookie is established before middleware runs
  const callbackUrl = `/auth/callback?next=${encodeURIComponent(targetUrl)}`;
  const urlError = searchParams.get("error");
  const [error, setError] = useState(
    urlError === "CredentialsSignin" ? "Invalid email or password" : ""
  );
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    getCsrfToken().then(setCsrfToken);
  }, []);

  useEffect(() => {
    setError(urlError === "CredentialsSignin" ? "Invalid email or password" : "");
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
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0f] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="flex items-center gap-2">
            <img src="/noteai-icon.svg" alt="NoteAI" className="h-10 w-10" />
            <span className="text-xl font-semibold text-white">NoteAI</span>
          </Link>
        </div>
        <LoginPanel
          onSubmit={handleSubmit}
          error={error}
          callbackUrl={callbackUrl}
          csrfToken={csrfToken}
          useFormPost={true}
        />
        <p className="mt-4 text-center text-sm text-white/60">
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
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0f]">
        <div className="text-white/60">Loading…</div>
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}
