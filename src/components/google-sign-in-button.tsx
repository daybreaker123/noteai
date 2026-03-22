"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui";

/**
 * Shared "Continue with Google" control for login & signup.
 * Uses an absolute callbackUrl so NextAuth + Google OAuth redirect correctly on all hosts.
 * Only renders if the Google provider is registered (env configured on the server).
 */
export function GoogleSignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [ready, setReady] = React.useState(false);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((p: Record<string, { id: string }>) => {
        setShow(!!p.google);
        setReady(true);
      })
      .catch(() => {
        setShow(false);
        setReady(true);
      });
  }, []);

  const handleGoogle = () => {
    const absolute =
      callbackUrl.startsWith("http://") || callbackUrl.startsWith("https://")
        ? callbackUrl
        : new URL(
            callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`,
            window.location.origin
          ).href;
    // redirect: true (default) — full navigation so Set-Cookie from OAuth completes before /auth/callback
    void signIn("google", { callbackUrl: absolute, redirect: true });
  };

  if (!ready) {
    return (
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="h-10 w-full animate-pulse rounded-xl bg-white/5" aria-hidden />
      </div>
    );
  }

  if (!show) return null;

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <Button
        type="button"
        className="w-full border border-white/15 bg-white/[0.06] text-white hover:bg-white/10 hover:border-white/25"
        onClick={handleGoogle}
      >
        Continue with Google
      </Button>
    </div>
  );
}
