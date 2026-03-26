"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";
import { Button, Card, Input } from "@/components/ui";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!tokenFromUrl) {
      setError("Missing reset token. Open the link from your email or request a new reset.");
    }
  }, [tokenFromUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!tokenFromUrl) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenFromUrl, password }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not reset password");
        return;
      }
      setDone(true);
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
          <h1 className="text-lg font-semibold text-[var(--text)]">Set new password</h1>
          {done ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-[var(--muted)]">Your password has been updated. You can log in now.</p>
              <Link
                href="/login"
                className={cn(
                  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--btn-default-bg)] px-3.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--btn-default-hover)]"
                )}
              >
                Log in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <Input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                required
                minLength={6}
                autoComplete="new-password"
                autoFocus={Boolean(tokenFromUrl)}
              />
              <Input
                type="password"
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                required
                minLength={6}
                autoComplete="new-password"
              />
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading || !tokenFromUrl}>
                {loading ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
          <p className="mt-5 text-center text-sm text-[var(--muted)]">
            <Link href="/forgot-password" className="text-[var(--accent)] hover:underline">
              Request a new link
            </Link>
            {" · "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
          <p className="text-[var(--muted)]">Loading…</p>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
