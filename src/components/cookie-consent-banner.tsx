"use client";

import * as React from "react";
import Link from "next/link";

const STORAGE_KEY = "studara_cookie_consent";

export function CookieConsentBanner() {
  const [mounted, setMounted] = React.useState(false);
  const [hidden, setHidden] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "accepted" || stored === "rejected") {
        setHidden(true);
      } else {
        setHidden(false);
      }
    } catch {
      setHidden(false);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      /* ignore quota / private mode */
    }
    setHidden(true);
  }

  function reject() {
    try {
      localStorage.setItem(STORAGE_KEY, "rejected");
    } catch {
      /* ignore quota / private mode */
    }
    setHidden(true);
  }

  if (!mounted || hidden) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="studara-cookie-panel pointer-events-auto w-full max-w-4xl rounded-2xl border border-[var(--border)] px-4 py-4 shadow-2xl backdrop-blur-xl sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-sm leading-relaxed text-[var(--text)]">
            We use cookies to keep you logged in and improve your experience. You can accept all cookies as described in our
            cookie policy, or reject non-essential cookies.
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/cookies"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--btn-default-bg)]"
            >
              Learn More
            </Link>
            <button
              type="button"
              onClick={reject}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--btn-default-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--border)]"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={accept}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-600/90 to-blue-600/90 px-5 text-sm font-semibold text-[var(--inverse-text)] shadow-lg transition hover:from-violet-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
