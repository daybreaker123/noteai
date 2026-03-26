"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  Quote,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  CITATION_STYLE_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  type CitationStyleId,
  type SourceTypeId,
} from "@/lib/citation-types";

const headerSelectClass =
  "min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--hover-bg-subtle)] py-2 pl-2.5 pr-7 text-base font-medium text-[var(--text)] outline-none transition focus:border-purple-500/45 focus:ring-2 focus:ring-purple-500/20 sm:min-h-10 sm:min-w-[10rem] sm:flex-none sm:pl-3 sm:text-xs md:text-sm";

type CitationResult = {
  description: string;
  citations: Record<CitationStyleId, string>;
  sourceInput: string;
  sourceType: SourceTypeId;
};

type CitationHistoryItem = CitationResult & {
  id: string;
  at: number;
  selectedStyle: CitationStyleId;
};

function CopyCitationButton({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--badge-free-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--btn-default-bg)]"
    >
      {done ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

export function CitationsPage() {
  const { status } = useSession();
  const [sourceInput, setSourceInput] = React.useState("");
  const [sourceType, setSourceType] = React.useState<SourceTypeId>("website");
  const [selectedStyle, setSelectedStyle] = React.useState<CitationStyleId>("apa");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState<CitationResult | null>(null);
  const [history, setHistory] = React.useState<CitationHistoryItem[]>([]);
  const [plan, setPlan] = React.useState<"free" | "pro" | null>(null);
  const [remaining, setRemaining] = React.useState<number | null>(null);

  const refreshUsage = React.useCallback(async () => {
    try {
      const res = await fetch("/api/ai/anthropic/citations", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        plan?: string;
        citations_remaining?: number | null;
      };
      setPlan(json.plan === "pro" ? "pro" : "free");
      if (json.citations_remaining != null) {
        setRemaining(json.citations_remaining);
      } else {
        setRemaining(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (status === "authenticated") void refreshUsage();
  }, [status, refreshUsage]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = sourceInput.trim();
    if (!text || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/anthropic/citations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_input: text,
          source_type: sourceType,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
        description?: string;
        citations?: Record<string, string>;
        citations_remaining?: number | null;
        plan?: string;
      } | null;

      if (json?.plan === "pro" || json?.plan === "free") {
        setPlan(json.plan);
      }
      if (json?.citations_remaining != null) {
        setRemaining(json.citations_remaining);
      } else if (json?.plan === "pro") {
        setRemaining(null);
      }

      if (res.status === 402 && json?.code === "FREE_LIMIT_CITATIONS") {
        setError(json.error ?? "Monthly limit reached.");
        setRemaining(0);
        return;
      }
      if (!res.ok || !json) {
        setError(json?.error ?? "Something went wrong. Try again.");
        return;
      }

      const c = json.citations;
      if (
        !c ||
        typeof c.apa !== "string" ||
        typeof c.mla !== "string" ||
        typeof c.chicago !== "string" ||
        typeof c.harvard !== "string"
      ) {
        setError("Invalid response from server.");
        return;
      }

      const result: CitationResult = {
        description: typeof json.description === "string" ? json.description : "",
        citations: {
          apa: c.apa,
          mla: c.mla,
          chicago: c.chicago,
          harvard: c.harvard,
        },
        sourceInput: text,
        sourceType,
      };
      setCurrent(result);

      const item: CitationHistoryItem = {
        ...result,
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        at: Date.now(),
        selectedStyle,
      };
      setHistory((h) => [item, ...h].slice(0, 10));
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const otherStyles = CITATION_STYLE_OPTIONS.filter((o) => o.id !== selectedStyle);
  const primaryText = current ? current.citations[selectedStyle] : "";

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--faint)]" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex min-h-dvh max-w-[100vw] flex-col overflow-x-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/14 via-indigo-600/10 to-fuchsia-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[480px] rounded-full bg-indigo-600/8 blur-3xl" />
      </div>

      <header className="relative z-20 shrink-0 border-b border-[var(--sidebar-border)] bg-[var(--header-bar)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center gap-3 px-4 py-4 sm:gap-4 sm:px-8 sm:py-5">
          <Link
            href="/notes"
            className="flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl px-3 py-2 text-base text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] sm:min-h-0 sm:px-2 sm:text-sm"
          >
            <ArrowLeft className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
            Notes
          </Link>
          <div className="hidden h-8 w-px bg-[var(--input-bg)] sm:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-gradient-to-br from-violet-500/25 to-cyan-500/15 shadow-inner">
              <Quote className="h-5 w-5 text-[var(--accent-fg)]" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">Citations</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">AI citation generator</p>
            </div>
          </div>
          {plan === "free" && remaining !== null ? (
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
              {remaining} free left this month
            </span>
          ) : plan === "pro" ? (
            <span className="rounded-full border border-[var(--pro-badge-border)] bg-[var(--pro-badge-bg)] px-3 py-1.5 text-xs font-medium text-[var(--pro-badge-fg)]">
              Pro · unlimited
            </span>
          ) : null}
          <ThemeToggle variant="icon" className="ml-auto shrink-0" />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[900px] flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
            <label htmlFor="citation-source" className="text-sm font-medium text-[var(--text)]">
              Source information
            </label>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Paste a URL, DOI, book title and author, podcast name, or any details you have.
            </p>
            <textarea
              id="citation-source"
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              disabled={loading}
              rows={6}
              placeholder="e.g. https://… or Smith, J. (2020). Learning Science. Penguin."
              className="mt-3 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--chrome-40)] px-4 py-3 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--placeholder)] outline-none transition focus:border-purple-500/45 focus:ring-2 focus:ring-purple-500/15 disabled:opacity-50"
            />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label htmlFor="source-type" className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Source type
                </label>
                <select
                  id="source-type"
                  className={cn(headerSelectClass, "w-full")}
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as SourceTypeId)}
                  disabled={loading}
                >
                  {SOURCE_TYPE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id} className="bg-[var(--surface-mid)] text-[var(--text)]">
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <label htmlFor="citation-style" className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Citation style
                </label>
                <select
                  id="citation-style"
                  className={cn(headerSelectClass, "w-full")}
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value as CitationStyleId)}
                  disabled={loading}
                >
                  {CITATION_STYLE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id} className="bg-[var(--surface-mid)] text-[var(--text)]">
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !sourceInput.trim() || (plan === "free" && remaining === 0)}
              className={cn(
                "mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 py-3.5 text-base font-semibold text-[var(--inverse-text)] shadow-lg shadow-purple-950/40 transition hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 disabled:pointer-events-none disabled:opacity-40"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-amber-200/90" strokeWidth={2} />
                  Generate citation
                </>
              )}
            </button>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200/95">
              {error}
              {(error.includes("upgrade") || error.includes("Pro") || error.includes("free citations")) && (
                <Link
                  href="/billing"
                  className="ml-2 font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  View plans
                </Link>
              )}
            </div>
          ) : null}
        </form>

        {current ? (
          <div className="mt-10 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--faint)]">Result</h2>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--modal-surface)] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--sidebar-border)] pb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-fg)]">
                    {CITATION_STYLE_OPTIONS.find((o) => o.id === selectedStyle)?.label ?? selectedStyle}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{current.description}</p>
                </div>
                <CopyCitationButton text={primaryText} />
              </div>
              <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-[0.9375rem] leading-relaxed text-[var(--text)]">
                {primaryText}
              </pre>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">Other styles</p>
              {otherStyles.map((o) => (
                <details
                  key={o.id}
                  className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--chrome-30)] transition open:border-[var(--border)] open:bg-[var(--chrome-40)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-[var(--text)] [&::-webkit-details-marker]:hidden">
                    <span>{o.label}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-[var(--sidebar-border)] px-4 py-4">
                    <div className="mb-3 flex justify-end">
                      <CopyCitationButton text={current.citations[o.id]} />
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--text)]">
                      {current.citations[o.id]}
                    </pre>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ) : null}

        {history.length > 0 ? (
          <section className="mt-12 border-t border-[var(--sidebar-border)] pt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--faint)]">Recent (this session)</h2>
            <ul className="mt-4 space-y-2">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent({
                        description: h.description,
                        citations: h.citations,
                        sourceInput: h.sourceInput,
                        sourceType: h.sourceType,
                      });
                      setSelectedStyle(h.selectedStyle);
                    }}
                    className="w-full rounded-xl border border-[var(--sidebar-border)] bg-white/[0.03] px-4 py-3 text-left text-sm transition hover:border-[var(--border)] hover:bg-[var(--hover-bg-subtle)]"
                  >
                    <span className="font-medium text-[var(--text)] line-clamp-1">{h.sourceInput}</span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">
                      {SOURCE_TYPE_OPTIONS.find((s) => s.id === h.sourceType)?.label} ·{" "}
                      {CITATION_STYLE_OPTIONS.find((s) => s.id === h.selectedStyle)?.label} ·{" "}
                      {new Date(h.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
