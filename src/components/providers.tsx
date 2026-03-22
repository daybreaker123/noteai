"use client";

import { SessionProvider } from "next-auth/react";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <CookieConsentBanner />
    </SessionProvider>
  );
}
