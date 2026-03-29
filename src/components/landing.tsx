"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  FolderTree,
  GraduationCap,
  Check,
  FileText,
  Mic,
  Presentation,
  Network,
  Quote,
  BookOpen,
  Zap,
  PenLine,
} from "lucide-react";
import { Card } from "@/components/ui";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { FREE_PLAN_FEATURES, PRO_FEATURES } from "@/components/pro-plan-selector";
import { cn } from "@/lib/cn";
import { captureAnalytics } from "@/lib/analytics";
import {
  formatUsd,
  proAnnualApproxPercentOff,
  proAnnualMonthlyEquivalent,
  PRO_ANNUAL_TOTAL_USD,
  PRO_MONTHLY_USD,
  proAnnualSavingsUsd,
  type BillingInterval,
} from "@/lib/pricing";

const IMG = {
  hero: "/screenshots/landing-hero.png",
  aiTutor: "/screenshots/AI%20Tutor.png",
  essayFeedback: "/screenshots/Essay%20Feedback.png",
  studyMode: "/screenshots/Study%20Mode.png",
} as const;

const HERO_WORDS = ["Your", "notes.", "Finally", "working", "for", "you."];

const FEATURE_ROWS: { title: string; desc: string; image: string; alt: string }[] = [
  {
    title: "AI Tutor with your notes in context",
    desc: "Start a focused chat, turn on “Use My Notes” when you want answers grounded in what you’ve saved, and attach images, PDFs, or Word files. Quick prompts help you understand concepts, review material, or work through a problem step by step.",
    image: IMG.aiTutor,
    alt: "Studara AI Tutor chat with new chat, suggestions, and note context toggle",
  },
  {
    title: "Essay feedback that reads like a rubric",
    desc: "Paste or write your draft, choose essay type and academic level, then get color-coded highlights in the editor plus an overall summary. Expand rubric-style sections—like thesis, structure, and evidence—to see what’s working and what to tighten next.",
    image: IMG.essayFeedback,
    alt: "Studara essay feedback with highlighted draft and rubric panel",
  },
  {
    title: "Study Mode: flashcards or quizzes",
    desc: "From your notes, jump into Study Mode and pick how you want to practice—flip through key-term flashcards at your own pace, or answer multiple-choice questions to check understanding and track progress.",
    image: IMG.studyMode,
    alt: "Studara Study Mode modal with flashcards and quiz options",
  },
];

const AI_TOOLS: {
  name: string;
  desc: string;
  icon: React.ElementType;
  href: string;
}[] = [
  { name: "AI Tutor", desc: "Chat with context from your notes or general help.", icon: GraduationCap, href: "/tutor" },
  { name: "Essay Feedback", desc: "Structured draft review with rubric-style guidance.", icon: PenLine, href: "/essay-feedback" },
  { name: "Study Guide", desc: "Category-wide guides for exam prep.", icon: BookOpen, href: "/notes" },
  { name: "Citation Generator", desc: "APA, MLA, and more from a source snippet.", icon: Quote, href: "/citations" },
  { name: "Concept Map", desc: "Visualize how ideas connect.", icon: Network, href: "/notes" },
  { name: "Voice to Notes", desc: "Lecture audio to structured notes.", icon: Mic, href: "/notes" },
  { name: "Lecture Analyzer", desc: "Slides and PDFs to study-ready notes.", icon: Presentation, href: "/notes" },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

function usePrefersReducedMotion() {
  return useReducedMotion() ?? false;
}

function HeroParticles() {
  const reduced = usePrefersReducedMotion();
  const dots = React.useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        left: `${(i * 17) % 100}%`,
        top: `${(i * 23 + (i % 7) * 11) % 100}%`,
        delay: (i % 12) * 0.15,
        size: 1 + (i % 3),
        opacity: 0.15 + (i % 5) * 0.06,
      })),
    []
  );
  if (reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className="absolute rounded-full bg-[var(--accent)]"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            opacity: d.opacity,
          }}
          animate={{ opacity: [d.opacity, d.opacity * 1.8, d.opacity], scale: [1, 1.4, 1] }}
          transition={{ duration: 4 + (d.id % 4), repeat: Infinity, delay: d.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function AmbientOrbs() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -top-48 left-[10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--accent)_22%,transparent)_0%,transparent_70%)] blur-[100px]"
        animate={reduced ? undefined : { x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 h-[420px] w-[480px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,#3b82f6_18%,transparent)_0%,transparent_72%)] blur-[90px]"
        animate={reduced ? undefined : { x: [0, -35, 0], y: [0, 50, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[380px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--wordmark-to)_15%,transparent)_0%,transparent_75%)] blur-[110px]"
        animate={reduced ? undefined : { x: [0, -25, 0], y: [0, -40, 0] }}
        transition={{ duration: 36, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
    </div>
  );
}

function CountUpStat({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = React.useState(0);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const duration = 2200;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, reduced]);

  return (
    <div ref={ref} className="text-center">
      <div className="font-mono text-4xl font-bold tabular-nums tracking-tight text-[var(--text)] sm:text-5xl md:text-6xl">
        {display.toLocaleString()}
        {suffix}
      </div>
      <p className="mt-3 text-sm text-[var(--muted)] sm:text-base">{label}</p>
    </div>
  );
}

function FeatureShowcaseRow({
  title,
  desc,
  image,
  alt,
  reverse,
}: {
  title: string;
  desc: string;
  image: string;
  alt: string;
  reverse: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.22 });
  const reduced = usePrefersReducedMotion();

  const imageBlock = (
    <motion.div
      className="relative min-h-[220px] flex-1 lg:min-h-[320px]"
      initial={reduced ? false : { opacity: 0, x: reverse ? 48 : -48 }}
      animate={inView ? { opacity: 1, x: 0 } : reduced ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="relative mx-auto h-full w-full max-w-xl overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--accent)_25%,var(--border))] bg-[var(--surface-mid)] shadow-[0_24px_80px_-20px_color-mix(in_oklab,var(--accent)_35%,transparent)] ring-1 ring-[var(--border-subtle)]"
        animate={reduced ? undefined : { y: [0, -7, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative aspect-[16/10] w-full">
          <Image src={image} alt={alt} fill className="object-cover object-top" sizes="(max-width: 1024px) 100vw, 50vw" />
        </div>
      </motion.div>
    </motion.div>
  );

  const textBlock = (
    <motion.div
      className="flex flex-1 flex-col justify-center px-1"
      initial={reduced ? false : { opacity: 0, x: reverse ? -40 : 40 }}
      animate={inView ? { opacity: 1, x: 0 } : reduced ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <h3 className="text-2xl font-semibold tracking-tight text-[var(--text)] sm:text-3xl">{title}</h3>
      <p className="mt-4 text-base leading-relaxed text-[var(--muted)] sm:text-lg">{desc}</p>
    </motion.div>
  );

  return (
    <div
      ref={ref}
      className={cn(
        "grid items-center gap-10 py-16 md:gap-16 md:py-24 lg:grid-cols-2 lg:gap-20",
        reverse && "lg:[&>*:first-child]:order-2"
      )}
    >
      {imageBlock}
      {textBlock}
    </div>
  );
}

function HowStep({
  n,
  title,
  desc,
  icon: Icon,
  fromLeft,
}: {
  n: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  fromLeft: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      ref={ref}
      className="relative flex gap-6 rounded-3xl border border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--panel)_88%,transparent)] p-6 backdrop-blur-xl sm:gap-8 sm:p-8"
      initial={reduced ? false : { opacity: 0, x: fromLeft ? -56 : 56 }}
      animate={inView ? { opacity: 1, x: 0 } : reduced ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="pointer-events-none absolute -left-1 -top-2 font-mono text-7xl font-black leading-none text-[color-mix(in_oklab,var(--accent)_12%,transparent)] sm:text-8xl">
        {n}
      </span>
      <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--accent)_30%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_10%,var(--input-bg))] text-[var(--accent-icon)]">
        <Icon className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <div className="relative z-10 min-w-0">
        <h3 className="text-xl font-semibold text-[var(--text)] sm:text-2xl">{title}</h3>
        <p className="mt-2 text-[var(--muted)] sm:text-base">{desc}</p>
      </div>
    </motion.div>
  );
}

export function Landing() {
  const [billingInterval, setBillingInterval] = React.useState<BillingInterval>("month");
  const reduced = usePrefersReducedMotion();

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
    <main className="min-h-dvh overflow-x-hidden bg-[var(--bg)] text-[var(--text)] antialiased">
      <AmbientOrbs />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Nav */}
        <motion.header
          className="flex h-16 items-center justify-between sm:h-[4.5rem]"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <StudaraWordmarkLink href="/" />
          <nav className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle variant="icon" />
            <Link href="/login" className="hidden text-sm text-[var(--muted)] transition hover:text-[var(--text)] sm:inline">
              Log in
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] transition hover:from-violet-500 hover:to-indigo-500 sm:px-5"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </motion.header>

        {/* Hero */}
        <section className="relative pt-10 pb-8 md:pt-16 md:pb-12">
          <HeroParticles />
          <motion.p
            className="text-center text-sm font-medium text-[var(--accent-label-muted)]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            For students, built by students.
          </motion.p>
          <motion.div
            className="mt-6 flex justify-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            <StudaraWordmarkLink href="/" />
          </motion.div>

          <h1 className="relative z-10 mx-auto mt-10 max-w-4xl text-center text-4xl font-bold leading-[1.08] tracking-tight sm:mt-12 sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="sr-only">Your notes. Finally working for you.</span>
            <span className="flex flex-wrap justify-center gap-x-[0.28em] gap-y-1" aria-hidden>
              {HERO_WORDS.map((word, i) => (
                <motion.span
                  key={`${word}-${i}`}
                  className="inline-block bg-gradient-to-b from-[var(--text)] to-[color-mix(in_oklab,var(--text)_55%,var(--muted))] bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduced ? 0 : 0.55,
                    delay: reduced ? 0 : 0.35 + i * 0.09,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {word}
                </motion.span>
              ))}
            </span>
          </h1>

          <motion.p
            className="mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed text-[var(--muted)] md:text-xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.95, duration: 0.55 }}
          >
            Stop re-reading notes hoping something sticks. Studara improves, summarizes, and turns them into flashcards,
            quizzes, and a 24/7 AI tutor—so you actually learn.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 1.15, duration: 0.5 }}
          >
            <Link
              href="/login"
              className="inline-flex w-full min-w-[200px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-8 py-3.5 text-base font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-lg)] transition hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 sm:w-auto"
            >
              Start free — no card
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#features"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-8 py-3.5 text-base font-semibold text-[var(--text)] transition hover:bg-[var(--btn-default-bg)] sm:w-auto"
            >
              Explore features
            </Link>
          </motion.div>

          {/* 3D mockup */}
          <div className="relative mx-auto mt-16 max-w-5xl md:mt-24 [perspective:1400px] [perspective-origin:50%_40%]">
            <motion.div
              className="relative mx-auto w-full"
              style={{ transformStyle: "preserve-3d" }}
              animate={
                reduced
                  ? { rotateX: 10, rotateY: -14, y: 0 }
                  : {
                      rotateX: [10, 12, 10],
                      rotateY: [-14, -16, -14],
                      y: [0, -10, 0],
                    }
              }
              transition={reduced ? { duration: 0 } : { duration: 10, repeat: Infinity, ease: "easeInOut" }}
            >
              <div
                className="relative rounded-2xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--border))] bg-[var(--chrome-40)] shadow-[0_32px_120px_-24px_color-mix(in_oklab,var(--accent)_45%,transparent),0_0_0_1px_var(--border-subtle)_inset] ring-1 ring-[var(--border-subtle)]"
                style={{ transform: "translateZ(0)" }}
              >
                <div
                  className="pointer-events-none absolute -inset-x-8 -bottom-24 h-48 rounded-[100%] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--accent)_42%,transparent),transparent_68%)] blur-3xl"
                  aria-hidden
                />
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl">
                  <Image
                    src={IMG.hero}
                    alt="Studara notes dashboard"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 1024px"
                    priority
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features + screenshots */}
        <section id="features" className="border-t border-[var(--border-subtle)]/80 pt-4">
          <motion.div
            className="mx-auto max-w-2xl pt-16 text-center md:pt-20"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-label)]"
            >
              Product
            </motion.p>
            <motion.h2
              variants={fadeUp}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
            >
              Built for deep work
            </motion.h2>
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 text-lg text-[var(--muted)]"
            >
              Every feature is wired to one goal: help you remember what matters.
            </motion.p>
          </motion.div>

          <div className="mx-auto max-w-6xl">
            {FEATURE_ROWS.map((row, i) => (
              <FeatureShowcaseRow key={row.title} {...row} reverse={i % 2 === 1} />
            ))}
          </div>
        </section>

        {/* AI Tools grid */}
        <section id="ai-tools" className="border-t border-[var(--border-subtle)]/80 py-20 md:py-28">
          <motion.div
            className="mx-auto max-w-2xl text-center"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          >
            <motion.p
              variants={fadeUp}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-label)]"
            >
              AI suite
            </motion.p>
            <motion.h2 variants={fadeUp} className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Tools that ship with Studara
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-[var(--muted)]">
              One workspace. Seven ways to learn faster—without tab overload.
            </motion.p>
          </motion.div>

          <motion.div
            className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.12 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }}
          >
            {AI_TOOLS.map((tool) => (
              <motion.div key={tool.name} variants={fadeUp} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
                <Link
                  href={tool.href}
                  className="group relative flex h-full flex-col rounded-2xl border border-[color-mix(in_oklab,var(--accent)_18%,var(--border))] bg-[color-mix(in_oklab,var(--panel)_75%,transparent)] p-5 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--accent)_40%,var(--border))] hover:shadow-[0_20px_50px_-18px_color-mix(in_oklab,var(--accent)_50%,transparent)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[color-mix(in_oklab,var(--accent)_25%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_12%,var(--input-bg))] text-[var(--accent-icon)] transition group-hover:scale-105">
                    <tool.icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-4 font-semibold text-[var(--text)]">{tool.name}</h3>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-[var(--muted)]">{tool.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] opacity-80 transition group-hover:opacity-100">
                    Open
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Social proof stats */}
        <section className="py-20 md:py-28">
          <motion.div
            className="mx-auto max-w-4xl rounded-3xl border border-[var(--border-subtle)] bg-[color-mix(in_oklab,var(--panel)_80%,transparent)] px-6 py-14 backdrop-blur-xl sm:px-12 md:py-16"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-label)]">
              Momentum
            </p>
            <h2 className="mt-3 text-center text-2xl font-bold sm:text-3xl">Students stay in flow with Studara</h2>
            <div className="mt-12 grid gap-12 sm:grid-cols-3 sm:gap-8">
              <CountUpStat value={14} suffix="+" label="Day study streaks (and counting)" />
              <CountUpStat value={1200} suffix="+" label="Notes created this semester" />
              <CountUpStat value={48000} suffix="+" label="Flashcards reviewed" />
            </div>
          </motion.div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-[var(--border-subtle)]/80 py-20 md:py-28">
          <motion.div
            className="mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.45 }}
            transition={{ duration: 0.55 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-label)]">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Three steps. No learning curve.</h2>
          </motion.div>
          <div className="mx-auto mt-14 max-w-3xl space-y-6">
            <HowStep
              n="1"
              title="Capture notes your way"
              desc="Type in class, paste from Docs, or import a lecture. Studara keeps the editor fast and distraction-free."
              icon={FileText}
              fromLeft
            />
            <HowStep
              n="2"
              title="Organize with categories"
              desc="File by subject or project—or let AI suggest the best folder so you spend less time sorting."
              icon={FolderTree}
              fromLeft={false}
            />
            <HowStep
              n="3"
              title="Activate AI when you study"
              desc="Summarize, quiz yourself, or open the tutor with your notes as context. The heavy lifting happens on demand."
              icon={Zap}
              fromLeft
            />
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-[var(--border-subtle)]/80 py-20 md:py-28">
          <motion.div
            className="mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55 }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple pricing</h2>
            <p className="mt-4 text-[var(--muted)]">Start free. Upgrade when Studara becomes your daily driver.</p>
          </motion.div>

          <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Pro billing</p>
            <div
              className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--chrome-40)] p-1 shadow-[inset_0_2px_8px_var(--shadow-composer-inset)]"
              role="group"
              aria-label="Pro plan billing period"
            >
              <button
                type="button"
                onClick={() => setBillingInterval("month")}
                className={cn(
                  "rounded-xl px-6 py-2.5 text-sm font-semibold transition",
                  billingInterval === "month"
                    ? "bg-gradient-to-r from-violet-600/90 to-indigo-600/90 text-[var(--inverse-text)] shadow-md"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("year")}
                className={cn(
                  "rounded-xl px-6 py-2.5 text-sm font-semibold transition",
                  billingInterval === "year"
                    ? "bg-gradient-to-r from-violet-600/90 to-indigo-600/90 text-[var(--inverse-text)] shadow-md"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Annual
              </button>
            </div>
            <p className="max-w-md text-center text-xs text-[var(--muted)]">
              {billingInterval === "year" ? (
                <>
                  <span className="font-medium text-[var(--accent-label-muted)]">~{proAnnualApproxPercentOff}% off</span>
                  {" · "}
                  Save {formatUsd(proAnnualSavingsUsd, 0)}/year · {formatUsd(proAnnualMonthlyEquivalent)}/mo equivalent
                </>
              ) : (
                <>Switch to annual to save ~{proAnnualApproxPercentOff}%.</>
              )}
            </p>
          </div>

          <motion.div
            className="mx-auto mt-10 grid max-w-5xl gap-8 lg:grid-cols-2 lg:items-stretch"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.55 }}
          >
            <Card className="flex flex-col border-[var(--border)] bg-[color-mix(in_oklab,var(--panel)_90%,transparent)] p-7 backdrop-blur-xl sm:p-8">
              <div className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Free</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{formatUsd(0, 0)}</span>
                <span className="text-[var(--muted)]">/month</span>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Full product to explore, with clear monthly caps on AI and study sessions. No credit card.
              </p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {FREE_PLAN_FEATURES.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-[var(--text)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-success-fg)]" aria-hidden />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] py-3 text-sm font-semibold transition hover:bg-[var(--btn-default-bg)]"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>

            <div className="relative flex min-h-full flex-col">
              <div
                className="pointer-events-none absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-violet-500/50 via-indigo-500/35 to-fuchsia-500/30 opacity-90"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -inset-px rounded-2xl shadow-[0_0_48px_-8px_color-mix(in_oklab,var(--accent)_55%,transparent)]"
                aria-hidden
              />
              <Card className="relative flex min-h-full flex-col border-[var(--border)] bg-[var(--modal-surface)] p-7 backdrop-blur-xl sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold uppercase tracking-wide">Pro</span>
                  <span className="rounded-full border border-[color-mix(in_oklab,var(--accent)_35%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_12%,var(--input-bg))] px-3 py-1 text-xs font-semibold text-[var(--accent-label)]">
                    Most popular
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-1">
                  {billingInterval === "year" ? (
                    <>
                      <span className="text-4xl font-bold">{formatUsd(proAnnualMonthlyEquivalent)}</span>
                      <span className="text-[var(--muted)]">/month</span>
                      <span className="ml-1 text-sm text-[var(--muted)]">billed annually</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">{formatUsd(PRO_MONTHLY_USD, 0)}</span>
                      <span className="text-[var(--muted)]">/month</span>
                    </>
                  )}
                </div>
                {billingInterval === "year" ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    <span className="font-medium text-[var(--text)]">{formatUsd(PRO_ANNUAL_TOTAL_USD, 0)}</span> per year
                    {" · "}
                    <span className="text-[var(--accent-label-muted)]">Save {formatUsd(proAnnualSavingsUsd, 0)}/year</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">Billed monthly · cancel anytime</p>
                )}
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Every limit removed—advanced essay feedback, spaced repetition, multi-note study, sharing, imports, and
                  priority AI in one plan.
                </p>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {PRO_FEATURES.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-[var(--text)]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-icon)]" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={billingInterval === "year" ? "/billing?interval=year" : "/billing"}
                  onClick={() =>
                    captureAnalytics("pro_upgrade_clicked", { placement: "landing_pricing", interval: billingInterval })
                  }
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] transition hover:from-violet-500 hover:to-indigo-500"
                >
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </Link>
              </Card>
            </div>
          </motion.div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-24">
          <motion.div
            className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--bg-subtle)_95%,black)] px-6 py-16 text-center md:px-16 md:py-24"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.6 }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent)]" />
            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Stop losing knowledge.
                <br />
                <span className="bg-gradient-to-r from-[var(--text)] via-[var(--accent)] to-[var(--stats-label-to)] bg-clip-text text-transparent">
                  Start actually learning.
                </span>
              </h2>
              <p className="mt-5 text-lg text-[var(--muted)]">
                Join students who finally made their notes work for them—not the other way around.
              </p>
              <div className="relative mx-auto mt-10 inline-block">
                {!reduced && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/60 to-indigo-500/60 blur-xl"
                    animate={{ opacity: [0.45, 0.85, 0.45], scale: [0.92, 1.05, 0.92] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden
                  />
                )}
                <Link
                  href="/login"
                  className="relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-10 py-4 text-base font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-lg)] transition hover:from-violet-500 hover:to-indigo-500"
                >
                  Create your free account
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--border)] py-12 md:py-14">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <StudaraWordmarkLink href="/" />
            <nav className="flex flex-col gap-3 text-sm text-[var(--muted)] sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
              <Link href="/privacy" className="transition hover:text-[var(--text)]">
                Privacy Policy
              </Link>
              <Link href="/terms" className="transition hover:text-[var(--text)]">
                Terms of Service
              </Link>
              <Link href="/cookies" className="transition hover:text-[var(--text)]">
                Cookie Policy
              </Link>
              <a href="mailto:support@studara.org" className="transition hover:text-[var(--text)]">
                support@studara.org
              </a>
              <Link href="/login" className="transition hover:text-[var(--text)]">
                Log in
              </Link>
            </nav>
          </div>
          <p className="mt-10 text-xs text-[var(--faint)]">
            © {new Date().getFullYear()} Studara. For students, built by students.
          </p>
        </footer>
      </div>
    </main>
  );
}
