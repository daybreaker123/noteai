"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Only allow same-origin path redirects (avoid open redirects). */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    let cancelled = false;

    async function go() {
      const target = next.startsWith("/") ? next : `/${next}`;
      // Wait until the session cookie is visible to /api/auth before hitting
      // middleware-protected routes (avoids first hop without session).
      let hasSession = false;
      for (let i = 0; i < 30; i++) {
        if (cancelled) return;
        try {
          const r = await fetch("/api/auth/session", { credentials: "include" });
          const data = (await r.json()) as { user?: unknown };
          if (data?.user) {
            hasSession = true;
            break;
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled) return;
      if (!hasSession) {
        window.location.replace("/login?error=OAuthCallback");
        return;
      }
      window.location.replace(target);
    }

    void go();
    return () => {
      cancelled = true;
    };
  }, [next]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)]">
      <div className="text-[var(--muted)]">Redirecting…</div>
    </main>
  );
}

/**
 * Intermediate page after successful login. NextAuth redirects here with the
 * session cookie set. We then do a client-side redirect to the target URL.
 * This ensures the cookie is fully established before the middleware runs on
 * protected routes (avoids redirect loop where middleware doesn't see session
 * on the first redirect request).
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Redirecting…</div>
      </main>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
