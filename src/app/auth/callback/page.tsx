"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  useEffect(() => {
    const target = next.startsWith("/") ? next : `/${next}`;
    window.location.replace(target);
  }, [next]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0f]">
      <div className="text-white/60">Redirecting…</div>
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
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0f]">
        <div className="text-white/60">Redirecting…</div>
      </main>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
