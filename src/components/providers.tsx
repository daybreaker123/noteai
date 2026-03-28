"use client";

import { SessionProvider } from "next-auth/react";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { PosthogProviderWrapper } from "@/components/posthog-provider";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PosthogProviderWrapper>
        <ThemeProvider>
          {children}
          <CookieConsentBanner />
        </ThemeProvider>
      </PosthogProviderWrapper>
    </SessionProvider>
  );
}
