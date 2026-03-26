"use client";

import { useState } from "react";
import Link from "next/link";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Card, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter your email address");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Request failed");
        return;
      }
      setMessage(json.message ?? "Check your email for a reset link.");
      setEmail("");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle variant="icon" />
      </div>
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/15 via-blue-500/10 to-fuchsia-500/10 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <StudaraWordmarkLink href="/" />
        </div>
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-[var(--text)]">Forgot password</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter the email you use to sign in with a password. We&apos;ll send a one-time link that expires in 1 hour.
          </p>
          {message ? (
            <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200/95">
              {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <Input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                autoComplete="email"
                autoFocus
              />
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
          <p className="mt-5 text-center text-sm text-[var(--muted)]">
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Back to log in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
