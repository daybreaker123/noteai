"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SignupPanel } from "@/components/signup-panel";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";

function SignupContent() {
  const searchParams = useSearchParams();
  const explicitNext = searchParams.get("callbackUrl");
  const plan = searchParams.get("plan");
  const interval = searchParams.get("interval");
  const billingSuffix =
    plan === "pro" && interval === "year"
      ? "?interval=year"
      : plan === "pro" && interval === "month"
        ? "?interval=month"
        : "";
  const targetUrl =
    explicitNext ?? (plan === "pro" ? `/billing${billingSuffix}` : "/dashboard");
  const callbackUrl = `/auth/callback?next=${encodeURIComponent(targetUrl)}`;
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)?.value;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;
    if (!email || !password || password.length < 6) {
      setError("Email and password (min 6 chars) required");
      return;
    }
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Signup failed");
      return;
    }
    const signInRes = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    if (signInRes?.error) {
      setError("Account created — please log in");
      return;
    }
    if (signInRes?.url) {
      window.location.replace(signInRes.url);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0f] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <StudaraWordmarkLink href="/" />
        </div>
        <SignupPanel onSubmit={handleSubmit} error={error} callbackUrl={callbackUrl} />
        <p className="mt-4 text-center text-sm text-white/60">
          Already have an account?{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(targetUrl)}`}
            className="text-[var(--accent)] hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0f]">
        <div className="text-white/60">Loading…</div>
      </main>
    }>
      <SignupContent />
    </Suspense>
  );
}
