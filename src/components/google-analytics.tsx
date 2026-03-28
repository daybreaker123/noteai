"use client";

import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

/**
 * Sends GA4 page_view on mount and whenever the App Router path or query string changes.
 * Requires gtag scripts in the root layout and `send_page_view: false` on initial config.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  React.useEffect(() => {
    if (!measurementId || typeof window === "undefined") return;
    const gtag = window.gtag;
    if (typeof gtag !== "function") return;

    const pagePath = search ? `${pathname}?${search}` : pathname;
    gtag("config", measurementId, { page_path: pagePath });
  }, [measurementId, pathname, search]);

  return null;
}
