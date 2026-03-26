import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { STUDARA_THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-constants";

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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
