import Link from "next/link";
import type { Metadata } from "next";
import "../privacy/privacy-policy.css";

export const metadata: Metadata = {
  title: "Terms of Service | Studara",
  description: "Studara terms of service and conditions of use.",
};

const sections: { title: string; body: string; contactEmail?: boolean }[] = [
  {
    title: "1. Acceptance of Terms",
    body: 'By accessing or using Studara ("the Service") at studara.org, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.',
  },
  {
    title: "2. Description of Service",
    body: 'Studara is an AI-powered academic study platform that allows users to create notes, generate summaries, flashcards, quizzes, and access an AI tutor. The Service is provided by Jack Davis ("we," "us," or "our") doing business as Studara.',
  },
  {
    title: "3. Eligibility",
    body: "You must be at least 13 years old to use Studara. By using the Service you confirm you meet this requirement.",
  },
  {
    title: "4. Accounts",
    body: "You are responsible for maintaining the security of your account and password. You are responsible for all activity that occurs under your account.",
  },
  {
    title: "5. Subscription and Payments",
    body: "Studara offers a free tier and a paid Pro subscription at $14/month or $134/year. Payments are processed by Stripe. Subscriptions automatically renew unless cancelled before the renewal date.",
  },
  {
    title: "6. Cancellation and Refunds",
    body: "You may cancel your subscription at any time from your profile page. Cancellations take effect at the end of the current billing period. We do not offer refunds for partial billing periods.",
  },
  {
    title: "7. User Content",
    body: "You retain ownership of all notes and content you create on Studara. By using the Service you grant us a limited license to process your content solely to provide AI features.",
  },
  {
    title: "8. Prohibited Use",
    body: "You may not use Studara to violate any laws, infringe on intellectual property rights, or attempt to gain unauthorized access to any part of the Service.",
  },
  {
    title: "9. AI Features",
    body: "AI-generated content is provided for educational assistance only. We do not guarantee the accuracy of AI-generated summaries, flashcards, or tutor responses. Always verify important information independently.",
  },
  {
    title: "10. Limitation of Liability",
    body: "Our liability is limited to the amount you paid us in the 12 months preceding any claim. We are not liable for indirect, incidental, or consequential damages.",
  },
  {
    title: "11. Dispute Resolution",
    body: "Any disputes will first be resolved through informal negotiation. If unresolved after 30 days, disputes will be settled through binding arbitration in your county.",
  },
  {
    title: "12. Changes to Terms",
    body: "We reserve the right to update these Terms at any time. We will notify users of significant changes via email.",
  },
  {
    title: "13. Contact",
    body: "For questions about these Terms contact us at ",
    contactEmail: true,
  },
];

export default function TermsPage() {
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
        <div data-custom-class="body">
          <div>
            <strong>
              <span data-custom-class="title">
                <h1>Terms of Service</h1>
              </span>
            </strong>
          </div>
          <div>
            <span style={{ color: "rgb(127, 127, 127)" }}>
              <strong>
                <span style={{ fontSize: 15 }}>
                  <span data-custom-class="subtitle">Last updated: March 22, 2026</span>
                </span>
              </strong>
            </span>
          </div>
          <div>
            <br />
          </div>
          <div>
            <br />
          </div>

          {sections.map(({ title, body, contactEmail }) => (
            <div key={title}>
              <div style={{ lineHeight: 1.5 }}>
                <strong>
                  <span data-custom-class="heading_1">
                    <h2>{title}</h2>
                  </span>
                </strong>
              </div>
              <div style={{ lineHeight: 1.5 }}>
                <span style={{ fontSize: 15 }}>
                  <span data-custom-class="body_text">
                    {body}
                    {contactEmail ? (
                      <>
                        <a data-custom-class="link" href="mailto:studarausersupport@gmail.com">
                          studarausersupport@gmail.com
                        </a>
                        .
                      </>
                    ) : null}
                  </span>
                </span>
              </div>
              <div style={{ lineHeight: 1.5 }}>
                <br />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
