"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  FileStack,
  FolderTree,
  ScanSearch,
  Wand2,
  GraduationCap,
  Check,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { PRO_FEATURES } from "@/components/pro-plan-selector";
import { cn } from "@/lib/cn";
import {
  formatUsd,
  proAnnualApproxPercentOff,
  proAnnualMonthlyEquivalent,
  PRO_ANNUAL_TOTAL_USD,
  PRO_MONTHLY_USD,
  proAnnualSavingsUsd,
  type BillingInterval,
} from "@/lib/pricing";

const LANDING_FREE_FEATURES = [
  "Up to 50 notes",
  "Up to 5 categories",
  "Basic text formatting",
  "10 AI summarizations per month",
  "5 AI improvements per month",
  "20 AI tutor messages per month",
  "5 tutor image uploads per month",
] as const;

function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      id={id}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}

export function Landing() {
  const [billingInterval, setBillingInterval] = React.useState<BillingInterval>("month");

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.add("landing-hide-scrollbar");
    document.body.classList.add("landing-hide-scrollbar");
    return () => {
      root.classList.remove("landing-hide-scrollbar");
      document.body.classList.remove("landing-hide-scrollbar");
    };
  }, []);

  return (
    <main className="min-h-dvh bg-[#0a0a0f] text-white antialiased">
      {/* Subtle gradient orbs - minimal */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-purple-500/[0.07] blur-[100px]" />
        <div className="absolute top-1/2 right-0 h-[300px] w-[400px] translate-y-1/2 rounded-full bg-blue-500/[0.05] blur-[80px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex h-16 items-center justify-between sm:h-[4.5rem]">
          <StudaraWordmarkLink href="/" />
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-white/60 transition hover:text-white/90"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/95"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <Section className="mt-20 text-center md:mt-28">
          <p className="text-sm font-medium text-white/50">For students, built by students.</p>
          <div className="mt-6 flex justify-center px-2 sm:mt-8 md:mt-10">
            <StudaraWordmarkLink href="/" />
          </div>
          <h1 className="relative mt-8 max-w-4xl mx-auto text-4xl font-bold tracking-tight sm:mt-10 sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="relative z-10 bg-gradient-to-b from-white to-white/90 bg-clip-text text-transparent">
              Your notes. Finally working for you.
            </span>
            <span className="absolute -inset-4 -z-0 rounded-2xl bg-gradient-to-r from-purple-500/20 via-transparent to-blue-500/20 blur-2xl" aria-hidden />
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60">
            Stop re-reading your notes hoping something sticks. Studara improves your notes, turns them into summaries,
            flashcards, quizzes, and gives you a 24/7 AI tutor — so you actually learn.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-black transition hover:bg-white/95 sm:w-auto"
            >
              Start free — no card required
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#how"
              className="text-sm text-white/50 transition hover:text-white/70"
            >
              See how it works
            </Link>
          </div>

          {/* App mockup */}
          <div className="mt-16 md:mt-24">
            <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur">
              <div className="flex border-b border-white/10 px-4 py-3">
                <div className="flex gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 text-white/50" />
                  <span className="text-xs text-white/50">Lecture Notes — Biology 101</span>
                </div>
              </div>
              <div className="flex min-h-[280px]">
                <div className="hidden w-56 shrink-0 border-r border-white/10 p-4 md:block">
                  <div className="mb-4 h-8 rounded-lg bg-white/10" />
                  <div className="space-y-1">
                    <div className="h-6 rounded bg-purple-500/20" />
                    <div className="h-6 rounded bg-white/5" />
                    <div className="h-6 rounded bg-white/5" />
                    <div className="h-6 rounded bg-white/5" />
                  </div>
                </div>
                <div className="flex-1 p-6">
                  <div className="h-6 w-48 rounded bg-white/10" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded bg-white/10" />
                    <div className="h-3 w-5/6 rounded bg-white/10" />
                    <div className="h-3 w-4/5 rounded bg-white/10" />
                    <div className="mt-4 h-3 w-3/4 rounded bg-white/10" />
                    <div className="h-3 w-full rounded bg-white/10" />
                  </div>
                  <div className="mt-6 rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-purple-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Summary
                    </div>
                    <div className="mt-2 h-4 w-full rounded bg-white/10" />
                    <div className="mt-1 h-4 w-4/5 rounded bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Features - 2x3 grid */}
        <Section id="features" className="mt-32 md:mt-40">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              AI that actually gets it
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white/60">
              No fluff. Just features that help you learn.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 md:mt-24 lg:gap-8">
            {[
              {
                icon: <Sparkles className="h-6 w-6 text-purple-400" />,
                title: "Summarize in one click",
                desc: "Long lecture? Get the key points in seconds.",
              },
              {
                icon: <Wand2 className="h-6 w-6 text-purple-400" />,
                title: "Improve your notes instantly",
                desc: "Paste in messy, incomplete notes and let AI rewrite them into clear, detailed, well-structured study material in one click.",
              },
              {
                icon: <FileStack className="h-6 w-6 text-blue-400" />,
                title: "AI Tutor + your notes",
                desc: "Flip on “Use My Notes” and the tutor can answer using everything you’ve saved — or keep it off for general help.",
              },
              {
                icon: <FolderTree className="h-6 w-6 text-purple-400" />,
                title: "Auto-categorize",
                desc: "Stop wasting time filing. AI suggests where it goes.",
              },
              {
                icon: <ScanSearch className="h-6 w-6 text-blue-400" />,
                title: "Search by meaning",
                desc: "Find notes by what they're about, not just keywords.",
              },
              {
                icon: <GraduationCap className="h-6 w-6 text-purple-400" />,
                title: "Study smarter with flashcards & quizzes",
                desc: "Turn any note into a full study session. AI generates flashcards and quizzes so you can actually retain what you learned.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex h-full flex-row gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/15"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  {f.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold sm:text-xl">{f.title}</h3>
                  <p className="mt-2 text-sm text-white/60">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* How it works */}
        <Section id="how" className="mt-32 md:mt-40">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white/60">
              Three steps. No learning curve.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl space-y-8">
            {[
              {
                step: "1",
                title: "Write like you always do",
                desc: "Take notes in class or paste from anywhere. No special formatting needed.",
              },
              {
                step: "2",
                title: "Organize with categories",
                desc: "Create categories that make sense for you. Or let AI suggest where things go.",
              },
              {
                step: "3",
                title: "Let AI do the heavy lifting",
                desc: "Summarize, expand bullets, generate flashcards — when you need it, not before.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="flex gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-white/15"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-semibold text-white/80">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 text-white/60">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Pricing */}
        <Section id="pricing" className="mt-32 md:mt-40">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Simple pricing
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white/60">
              Start free. Upgrade when you&apos;re ready — compare plans and billing options below.
            </p>
          </div>

          {/* Monthly / Annual toggle — applies to Pro pricing */}
          <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Pro billing period</p>
            <div
              className="inline-flex rounded-xl border border-white/12 bg-black/40 p-1 shadow-inner shadow-black/40"
              role="group"
              aria-label="Pro plan billing period"
            >
              <button
                type="button"
                onClick={() => setBillingInterval("month")}
                className={cn(
                  "rounded-lg px-5 py-2.5 text-sm font-semibold transition",
                  billingInterval === "month"
                    ? "bg-gradient-to-r from-purple-500/40 to-blue-500/35 text-white shadow-sm"
                    : "text-white/55 hover:text-white/85"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("year")}
                className={cn(
                  "rounded-lg px-5 py-2.5 text-sm font-semibold transition",
                  billingInterval === "year"
                    ? "bg-gradient-to-r from-purple-500/40 to-blue-500/35 text-white shadow-sm"
                    : "text-white/55 hover:text-white/85"
                )}
              >
                Annual
              </button>
            </div>
            <p className="max-w-md text-center text-xs text-white/45">
              {billingInterval === "year" ? (
                <>
                  <span className="font-medium text-purple-200/90">~{proAnnualApproxPercentOff}% off</span>
                  {" · "}
                  Save {formatUsd(proAnnualSavingsUsd, 0)}/year vs paying monthly ·{" "}
                  {formatUsd(proAnnualMonthlyEquivalent)}/mo equivalent
                </>
              ) : (
                <>Switch to annual to save ~{proAnnualApproxPercentOff}%.</>
              )}
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-8 lg:grid-cols-2 lg:items-stretch">
            {/* Free */}
            <Card className="flex flex-col border-white/10 bg-black/30 p-7 backdrop-blur-xl sm:p-8">
              <div className="text-sm font-semibold uppercase tracking-wide text-white/55">Free</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-white">{formatUsd(0, 0)}</span>
                <span className="text-white/50">/month</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                Everything you need to try Studara. No credit card required.
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {LANDING_FREE_FEATURES.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm leading-snug text-white/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/85" aria-hidden />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>

            {/* Pro — glowing border + Most Popular */}
            <div className="relative flex min-h-full flex-col">
              <div
                className="pointer-events-none absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-purple-500/55 via-blue-500/35 to-fuchsia-500/35 opacity-95"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -inset-px rounded-2xl shadow-[0_0_48px_-6px_rgba(139,92,246,0.5)]"
                aria-hidden
              />
              <Card className="relative flex min-h-full flex-col border-white/10 bg-black/40 p-7 backdrop-blur-xl sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wide text-white/90">Pro</span>
                  <span className="rounded-full border border-white/10 bg-gradient-to-r from-purple-500/45 to-blue-500/35 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    Most Popular
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-1">
                  {billingInterval === "year" ? (
                    <>
                      <span className="text-4xl font-bold tracking-tight text-white">
                        {formatUsd(proAnnualMonthlyEquivalent)}
                      </span>
                      <span className="text-white/50">/month</span>
                      <span className="ml-1 text-sm text-white/45">billed annually</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold tracking-tight text-white">{formatUsd(PRO_MONTHLY_USD, 0)}</span>
                      <span className="text-white/50">/month</span>
                    </>
                  )}
                </div>
                {billingInterval === "year" ? (
                  <p className="mt-2 text-sm text-white/55">
                    <span className="font-medium text-white/80">{formatUsd(PRO_ANNUAL_TOTAL_USD, 0)}</span> per year
                    {" · "}
                    <span className="text-purple-200/85">Save {formatUsd(proAnnualSavingsUsd, 0)}/year</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-white/50">Billed monthly · cancel anytime</p>
                )}
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  Full power for students who want their notes to work harder — unlimited AI, search, exports, and study
                  tools.
                </p>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {PRO_FEATURES.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm leading-snug text-white/85">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-400/90" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={billingInterval === "year" ? "/billing?interval=year" : "/billing"}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/85 to-blue-500/85 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/15 transition hover:from-purple-500 hover:to-blue-500"
                >
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </Link>
              </Card>
            </div>
          </div>
        </Section>

        {/* Testimonials */}
        <Section id="testimonials" className="mt-32 md:mt-40">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              What students are saying
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white/60">
              Real feedback from people who actually use it.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                initials: "JK",
                name: "Jordan K.",
                role: "Pre-med, UCLA",
                quote: "Finally, notes that don't just sit there. The flashcards from my lecture notes saved me on the midterm.",
              },
              {
                initials: "SM",
                name: "Sofia M.",
                role: "CS major",
                quote: "I paste my code notes in and ask questions. It's like having a TA that actually read my notes.",
              },
              {
                initials: "DT",
                name: "David T.",
                role: "Grad student",
                quote: "Search across my notes and turn them into flashcards — I finally connect ideas between classes.",
              },
            ].map((t) => (
              <Card key={t.name} className="flex flex-col p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white/80">
                  {t.initials}
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-white/80">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-4">
                  <div className="font-semibold text-white/90">{t.name}</div>
                  <div className="text-xs text-white/50">{t.role}</div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        {/* Final CTA */}
        <Section className="mt-32 md:mt-40">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center md:px-12 md:py-24">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Stop losing knowledge.
              <br />
              Start actually learning.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/60">
              Join students who are finally making their notes work for them.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-black transition hover:bg-white/95"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Section>

        {/* Footer */}
        <footer className="mt-24 border-t border-white/10 py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <StudaraWordmarkLink href="/" />
            <div className="flex flex-wrap gap-6 text-sm text-white/50">
              <Link href="#features" className="transition hover:text-white/80">
                Features
              </Link>
              <Link href="#how" className="transition hover:text-white/80">
                How it works
              </Link>
              <Link href="#pricing" className="transition hover:text-white/80">
                Pricing
              </Link>
              <Link href="/login" className="transition hover:text-white/80">
                Log in
              </Link>
              <Link href="/terms" className="transition hover:text-white/80">
                Terms of Service
              </Link>
              <Link href="/privacy" className="transition hover:text-white/80">
                Privacy Policy
              </Link>
              <Link href="/cookies" className="transition hover:text-white/80">
                Cookie Policy
              </Link>
              <a
                href="mailto:studarausersupport@gmail.com"
                className="transition hover:text-white/80"
              >
                Support · support@studara.org
              </a>
            </div>
          </div>
          <div className="mt-8 text-xs text-white/40">
            © {new Date().getFullYear()} Studara. For students, built by students.
          </div>
        </footer>
      </div>
    </main>
  );
}
