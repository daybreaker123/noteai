import Link from "next/link";
import type { Metadata } from "next";
import "../privacy/privacy-policy.css";
import { getTermlyLogoHtmlFromPrivacy } from "@/lib/termly-logo-html";
import { CookiePolicyBody } from "./cookie-policy-body";

export const metadata: Metadata = {
  title: "Cookie Policy | Studara",
  description: "How Studara uses cookies and similar technologies on studara.org.",
};

export default function CookiesPage() {
  const logoHtml = getTermlyLogoHtmlFromPrivacy();

  return (
    <div className="privacy-policy-page min-h-dvh bg-white text-neutral-800 antialiased">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-sm font-medium text-violet-700 hover:text-violet-900 hover:underline">
            ← Back to Studara
          </Link>
        </div>
      </header>
      <div className="privacy-policy-inner mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {logoHtml ? <div dangerouslySetInnerHTML={{ __html: logoHtml }} /> : null}
        <CookiePolicyBody />
        <div>
          <br />
          <div>
            <span data-custom-class="body_text">This Cookie Policy was created using Termly&apos;s </span>
            <a
              href="https://termly.io/products/cookie-consent-manager/"
              target="_blank"
              rel="noopener external"
              data-custom-class="link"
            >
              Cookie Consent Manager
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
