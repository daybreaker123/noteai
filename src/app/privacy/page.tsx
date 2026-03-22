import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import "./privacy-policy.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Studara",
  description: "Studara privacy policy and how we handle your data.",
};

function loadPrivacyHtml(): string {
  const fragmentPath = path.join(process.cwd(), "src/app/privacy/privacy-body.partial.html");
  try {
    return fs.readFileSync(fragmentPath, "utf-8");
  } catch {
    return "<p>Privacy policy content could not be loaded.</p>";
  }
}

export default function PrivacyPage() {
  const html = loadPrivacyHtml();

  return (
    <div className="privacy-policy-page min-h-dvh bg-white text-neutral-800 antialiased">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-sm font-medium text-violet-700 hover:text-violet-900 hover:underline">
            ← Back to Studara
          </Link>
        </div>
      </header>
      <div
        className="privacy-policy-inner mx-auto max-w-4xl px-4 py-10 sm:px-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
