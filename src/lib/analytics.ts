import posthog from "posthog-js";

/**
 * Client-side analytics (PostHog). No-ops when `NEXT_PUBLIC_POSTHOG_KEY` is unset or on the server.
 */
export function captureAnalytics(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()) return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* optional */
  }
}
