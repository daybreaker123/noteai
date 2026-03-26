"use client";

import { SessionProvider } from "next-auth/react";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <CookieConsentBanner />
      </ThemeProvider>
    </SessionProvider>
  );
}
