"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  MessageCircle,
  FolderTree,
  ScanSearch,
  Sparkle,
  Check,
  PlayCircle,
  Star,
  Shield,
} from "lucide-react";
import { Card } from "@/components/ui";

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
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-sm">
        <img src="/noteai-icon.svg" alt="NoteAI" className="h-full w-full" />
      </div>
      <div className="leading-tight">
        <div className="text-lg font-semibold tracking-tight text-white/95">NoteAI</div>
        <div className="text-sm text-white/60">AI note-taking, done right</div>
      </div>
    </div>
  );
}

function PrimaryButton(props: React.ComponentProps<typeof Link>) {
  const { className, ...rest } = props;
  return (
    <Link
      {...rest}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90",
        className ?? "",
      ].join(" ")}
    />
  );
}

function SecondaryButton(props: React.ComponentProps<typeof Link>) {
  const { className, ...rest } = props;
  return (
    <Link
      {...rest}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10",
        className ?? "",
      ].join(" ")}
    />
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-white/70">
      {children}
    </span>
  );
}

export function Landing() {
  const [checkoutBusy, setCheckoutBusy] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string>("");

  async function startCheckout() {
    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error ?? "Checkout failed.");
      if (typeof json?.url !== "string") throw new Error("Missing checkout URL.");
      window.location.href = json.url;
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <main className="min-h-dvh text-white">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/25 via-blue-500/15 to-fuchsia-500/20 blur-3xl" />
          <div className="absolute top-[380px] left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-600/20 to-emerald-500/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <header className="relative z-10 flex items-center justify-between gap-3">
            <Logo />
            <nav className="flex items-center gap-3">
              <Link className="text-sm text-white/65 hover:text-white/90" href="/login">
                Log in
              </Link>
              <PrimaryButton href="/login">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </nav>
          </header>

          <Section className="relative z-10 mt-12 md:mt-16">
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Pill>
                    <Shield className="h-3.5 w-3.5" />
                    Private by design
                  </Pill>
                  <Pill>
                    <Sparkles className="h-3.5 w-3.5" />
                    AI when you ask
                  </Pill>
                </div>

                <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
                  The fastest way to take notes — and actually find them later.
                </h1>
                <p className="mt-4 text-base leading-7 text-white/70">
                  Summarize long notes instantly, organize with custom categories, search everything, and keep your notes
                  synced across devices.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <PrimaryButton href="/login">
                    Get Started Free <ArrowRight className="h-4 w-4" />
                  </PrimaryButton>
                  <SecondaryButton href="#how">
                    <PlayCircle className="h-4 w-4" />
                    See How It Works
                  </SecondaryButton>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/55">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">No credit card for Free</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Cancel anytime</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Works on mobile</span>
                </div>
              </div>

              <Card className="relative overflow-hidden p-5">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
                <div className="relative">
                  <div className="text-sm font-semibold text-white/90">Live preview</div>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-sm font-semibold">Meeting notes</div>
                      <div className="mt-1 text-xs text-white/60">AI summary → action items → follow-ups</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Category</div>
                        <span className="text-xs text-white/60">Product</span>
                      </div>
                      <div className="mt-2 h-2 w-5/6 rounded bg-white/10" />
                      <div className="mt-2 h-2 w-3/4 rounded bg-white/10" />
                      <div className="mt-2 h-2 w-2/3 rounded bg-white/10" />
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-sm font-semibold">Search</div>
                      <div className="mt-1 text-xs text-white/60">Find anything across categories in seconds.</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </Section>

          <Section className="relative z-10 mt-10 md:mt-14">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                <div className="text-sm text-white/70">
                  Trusted by builders, students, and teams. <span className="text-white/90 font-semibold">10,000+</span>{" "}
                  notes created this week.
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <span className="rounded-xl border border-white/10 bg-black/10 px-3 py-1">4.8/5 avg rating</span>
                  <span className="rounded-xl border border-white/10 bg-black/10 px-3 py-1">Privacy-first</span>
                  <span className="rounded-xl border border-white/10 bg-black/10 px-3 py-1">Pro features</span>
                </div>
              </div>
            </div>
          </Section>

          <Section id="features" className="relative z-10 mt-14 md:mt-20">
            <div className="text-center">
              <div className="mx-auto inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold leading-none text-white/80">
                Features
              </div>
              <h2 className="mx-auto mt-2 max-w-[28rem] whitespace-normal break-words text-2xl font-semibold leading-tight tracking-tight sm:max-w-none md:text-3xl">
                AI that makes notes useful
              </h2>
              <p className="mt-3 text-sm text-white/65">
                Four core AI capabilities designed for real work: summarize, ask, auto-organize, and find notes by meaning.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                {
                  icon: <Sparkles className="h-5 w-5" />,
                  title: "AI summarization",
                  desc: "Turn long notes into crisp summaries and next steps in one click.",
                },
                {
                  icon: <MessageCircle className="h-5 w-5" />,
                  title: "AI chat with your notes",
                  desc: "Ask questions across all your notes and get grounded answers fast.",
                },
                {
                  icon: <FolderTree className="h-5 w-5" />,
                  title: "AI auto-categorization",
                  desc: "Auto-suggest the best category for each note so you stay organized.",
                },
                {
                  icon: <ScanSearch className="h-5 w-5" />,
                  title: "Semantic AI search",
                  desc: "Find the right note by meaning — not just keywords.",
                },
              ].map((f) => (
                <Card key={f.title} className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/85">{f.icon}</div>
                    <div>
                      <div className="text-sm font-semibold text-white/90">{f.title}</div>
                      <div className="mt-1 text-sm text-white/65">{f.desc}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>

          <Section id="how" className="relative z-10 mt-14 md:mt-20">
            <div className="grid gap-8 md:grid-cols-2 md:items-start">
              <div>
                <div className="text-sm font-semibold text-white/80">How it works</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Three steps to clarity</h2>
                <p className="mt-3 text-sm text-white/65">
                  Capture quickly, organize naturally, and let AI do the formatting when you need it.
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  {
                    n: "1",
                    title: "Write or import a note",
                    desc: "Fast editor with markdown preview, tags, and pinning.",
                  },
                  {
                    n: "2",
                    title: "Assign a category",
                    desc: "Keep notes grouped with custom categories and an All Notes view.",
                  },
                  {
                    n: "3",
                    title: "Use AI to refine",
                    desc: "Summarize, rewrite, extract tasks, or generate titles and tags.",
                  },
                ].map((s) => (
                  <Card key={s.n} className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white/85">
                        {s.n}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white/90">{s.title}</div>
                        <div className="mt-1 text-sm text-white/65">{s.desc}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Section>

          <Section id="pricing" className="relative z-10 mt-14 md:mt-20">
            <div className="text-center">
              <div className="text-sm font-semibold text-white/80">Pricing</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Simple plans that scale with you</h2>
              <p className="mt-3 text-sm text-white/65">Start free. Upgrade when you want more power.</p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Card className="p-6">
                <div className="text-sm font-semibold text-white/90">Free</div>
                <div className="mt-2 flex items-end gap-2">
                  <div className="text-3xl font-semibold">$0</div>
                  <div className="text-sm text-white/60">/ month</div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-white/70">
                  {[
                    "Up to 50 notes",
                    "Up to 5 categories",
                    "Basic text formatting",
                    "10 AI summarizations / month",
                  ].map((t) => (
                    <div className="flex items-center gap-2" key={t}>
                      <Check className="h-4 w-4 text-emerald-300" />
                      {t}
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <PrimaryButton href="/login" className="w-full">
                    Get Started Free <ArrowRight className="h-4 w-4" />
                  </PrimaryButton>
                </div>
              </Card>

              <div className="relative">
                <div className="pointer-events-none absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-purple-500/70 via-blue-500/60 to-fuchsia-500/60 blur-sm" />
                <Card className="relative p-6 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white/95">Pro</div>
                      <div className="mt-1 text-sm text-white/65">For power users who live in notes</div>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                      <Sparkle className="h-3.5 w-3.5" />
                      Most Popular
                    </span>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="text-3xl font-semibold">$14</div>
                    <div className="text-sm text-white/60">/ month</div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-white/70">
                    {[
                      "Unlimited notes",
                      "Unlimited categories",
                      "Unlimited AI summarization",
                      "AI chat with your notes (across all notes)",
                      "AI auto-tagging + auto-categorization suggestions",
                      "AI writing assistant (expand bullets into full notes)",
                      "Semantic AI search (meaning-based)",
                      "PDF + Markdown export",
                      "Image attachments",
                    ].map((t) => (
                      <div className="flex items-start gap-2" key={t}>
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <div>{t}</div>
                      </div>
                    ))}
                  </div>
                  {checkoutError ? (
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-red-200">
                      {checkoutError}
                    </div>
                  ) : null}
                  <div className="mt-6">
                    <button
                      onClick={startCheckout}
                      disabled={checkoutBusy}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                    >
                      {checkoutBusy ? "Redirecting…" : "Upgrade to Pro (Stripe)"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <div className="mt-2 text-center text-xs text-white/55">Requires login to start checkout.</div>
                  </div>
                </Card>
              </div>
            </div>
          </Section>

          <Section id="testimonials" className="relative z-10 mt-14 md:mt-20">
            <div className="text-center">
              <div className="text-sm font-semibold text-white/80">Testimonials</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Loved for speed and clarity</h2>
              <p className="mt-3 text-sm text-white/65">
                Add real customer quotes when you're ready — this section is intentionally minimal for now.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <Card key={idx} className="p-5">
                  <div className="flex items-center gap-1 text-amber-300">
                    {Array.from({ length: 5 }).map((__, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-white/75">
                    "Add a short customer quote here."
                  </div>
                  <div className="mt-4 text-sm font-semibold text-white/90">Customer</div>
                  <div className="text-xs text-white/55">Role</div>
                </Card>
              ))}
            </div>
          </Section>

          <footer className="relative z-10 mt-16 border-t border-white/10 py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <Logo />
              <div className="flex flex-wrap gap-4 text-sm text-white/65">
                <Link className="hover:text-white/90" href="#features">
                  Features
                </Link>
                <Link className="hover:text-white/90" href="#how">
                  How it works
                </Link>
                <Link className="hover:text-white/90" href="#pricing">
                  Pricing
                </Link>
                <Link className="hover:text-white/90" href="/login">
                  Log in
                </Link>
              </div>
            </div>
            <div className="mt-6 text-xs text-white/45">© {new Date().getFullYear()} NoteAI. All rights reserved.</div>
          </footer>
        </div>
      </div>
    </main>
  );
}
