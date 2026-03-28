"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

function PosthogIdentify() {
  const { data: session, status } = useSession();

  React.useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()) return;

    if (status === "loading") return;

    if (status !== "authenticated" || !session?.user) {
      posthog.reset();
      return;
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/plan", { credentials: "include" });
        const j = (await res.json().catch(() => ({ plan: "free" }))) as { plan?: string };
        if (cancelled) return;
        const planType = j.plan === "pro" ? "pro" : "free";
        posthog.identify(userId, {
          email: session.user.email ?? undefined,
          name: session.user.name ?? undefined,
          plan: planType,
          plan_type: planType,
        });
      } catch {
        if (!cancelled) {
          posthog.identify(userId, {
            email: session.user.email ?? undefined,
            name: session.user.name ?? undefined,
            plan: "free",
            plan_type: "free",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, status]);

  return null;
}

export function PosthogProviderWrapper({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com").replace(/\/$/, "");
    if (!key) return;
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
    });
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider client={posthog}>
      <PosthogIdentify />
      {children}
    </PostHogProvider>
  );
}
