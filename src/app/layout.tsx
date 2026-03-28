import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import { GoogleAnalytics } from "@/components/google-analytics";
import { Providers } from "@/components/providers";
import { STUDARA_THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-constants";

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Studara",
  description:
    "Studara: AI-powered studying for students. Summarize, search by meaning, and turn notes into flashcards.",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    shortcut: "/logo.png",
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased overflow-x-hidden">
        <Script id="studara-theme-init" strategy="beforeInteractive">
          {STUDARA_THEME_BOOTSTRAP_SCRIPT}
        </Script>
        {gaMeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('config',${JSON.stringify(gaMeasurementId)},{send_page_view:false});`}
            </Script>
            <Suspense fallback={null}>
              <GoogleAnalytics measurementId={gaMeasurementId} />
            </Suspense>
          </>
        ) : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
