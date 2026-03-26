"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Bookmark, Loader2, Trash2, BookOpen, X, Link2 } from "lucide-react";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Note, StudySetSummary } from "@/lib/api-types";
import { ShareResourceModal } from "@/components/share-resource-modal";
import type { FlashcardDueSummaryItem } from "@/lib/flashcard-progress-types";

export function StudySetsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [sets, setSets] = React.useState<StudySetSummary[]>([]);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [dueItems, setDueItems] = React.useState<FlashcardDueSummaryItem[]>([]);
  const [shareStudySetId, setShareStudySetId] = React.useState<string | null>(null);
  const [linkCopiedToast, setLinkCopiedToast] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [setsRes, notesRes, dueRes] = await Promise.all([
        fetch("/api/study-sets", { credentials: "include" }),
        fetch("/api/notes", { credentials: "include" }),
        fetch("/api/flashcard-progress/due-summary", { credentials: "include" }),
      ]);
      if (setsRes.ok) {
        const j = (await setsRes.json()) as { sets?: StudySetSummary[] };
        setSets(Array.isArray(j.sets) ? j.sets : []);
      } else {
        setSets([]);
      }
      if (notesRes.ok) {
        const n = (await notesRes.json()) as Note[];
        setNotes(Array.isArray(n) ? n : []);
      } else {
        setNotes([]);
      }
      if (dueRes.ok) {
        const d = (await dueRes.json()) as { items?: FlashcardDueSummaryItem[] };
        setDueItems(Array.isArray(d.items) ? d.items : []);
      } else {
        setDueItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  React.useEffect(() => {
    if (!linkCopiedToast) return;
    const t = window.setTimeout(() => setLinkCopiedToast(false), 2500);
    return () => window.clearTimeout(t);
  }, [linkCopiedToast]);

  function sourceLabel(s: StudySetSummary): string {
    if (!s.note_id) return "Multiple or unsourced";
    const n = notes.find((x) => x.id === s.note_id);
    if (n?.title?.trim()) return n.title.trim();
    return "Note";
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/study-sets/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setSets((prev) => prev.filter((x) => x.id !== id));
      } else {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setDeleteError(j?.error ?? "Could not delete study set");
      }
    } catch {
      setDeleteError("Could not delete study set — please check your connection.");
    } finally {
      setDeletingId(null);
    }
  }

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
    <div className="relative min-h-dvh max-w-[100vw] overflow-x-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/14 via-blue-500/10 to-fuchsia-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-[var(--sidebar-border)] bg-[var(--header-bar)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Link
              href="/notes"
              className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl px-3 py-2 text-base text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] sm:min-h-0 sm:px-2 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Notes
            </Link>
            <div className="hidden h-8 w-px bg-[var(--input-bg)] sm:block" aria-hidden />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-gradient-to-br from-purple-500/25 to-indigo-500/15">
                  <Bookmark className="h-4 w-4 text-purple-200/90" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Study sets</h1>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">Saved flashcards and quizzes</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle variant="icon" />
            <StudaraWordmarkLink href="/notes" />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {deleteError ? (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            <span className="min-w-0">{deleteError}</span>
            <button
              type="button"
              onClick={() => setDeleteError(null)}
              className="shrink-0 rounded-lg p-1 text-red-300 transition hover:bg-red-500/20 hover:text-[var(--text)]"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-9 w-9 animate-spin text-[var(--placeholder)]" />
          </div>
        ) : (
          <>
            {dueItems.length > 0 ? (
              <section className="mb-10 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-[var(--text)]">Due for review</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Flashcards scheduled for today (SM-2 spaced repetition). Review only what&apos;s due — not the full set.
                </p>
                <ul className="mt-4 space-y-3">
                  {dueItems.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--chrome-20)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--text)]">{d.title}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {d.due_count} of {d.total_cards} card{d.due_count === 1 ? "" : "s"} due today
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full shrink-0 border-0 bg-gradient-to-r from-amber-600/90 to-orange-600/90 text-[var(--inverse-text)] hover:from-amber-500 hover:to-orange-500 sm:w-auto"
                        onClick={() => router.push(`/study-sets/review/${encodeURIComponent(d.id)}`)}
                      >
                        Review due cards
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {sets.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-[var(--sidebar-border)] bg-white/[0.03] px-8 py-16 text-center backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-gradient-to-br from-purple-500/15 to-blue-500/10">
              <Bookmark className="h-8 w-8 text-[var(--placeholder)]" />
            </div>
            <p className="mt-6 text-lg font-medium text-[var(--text)]">No saved sets yet</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Generate flashcards or a quiz from a note, then save from study mode.
            </p>
            <Link
              href="/notes"
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-5 py-2.5 text-sm font-semibold text-[var(--inverse-text)] shadow-lg transition hover:from-purple-500 hover:to-blue-500"
            >
              Back to notes
            </Link>
          </div>
            ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((s) => (
              <div
                key={s.id}
                className="group flex min-h-[200px] flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-5 shadow-sm transition duration-200 hover:border-purple-500/25 hover:bg-[var(--badge-free-bg)]"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <h2 className="line-clamp-2 text-base font-semibold leading-snug text-[var(--text)]">{s.title}</h2>
                  <Badge
                    className={cn(
                      "w-fit border-0 text-xs font-medium",
                      s.kind === "flashcards"
                        ? "bg-violet-500/20 text-violet-200"
                        : "bg-cyan-500/15 text-cyan-200"
                    )}
                  >
                    {s.kind === "flashcards" ? "Flashcards" : "Quiz"}
                  </Badge>
                  <p className="text-xs leading-relaxed text-[var(--muted)]">
                    <span className="text-[var(--placeholder)]">Source · </span>
                    {sourceLabel(s)}
                  </p>
                  <p className="text-xs text-[var(--placeholder)]">
                    {s.item_count} {s.kind === "flashcards" ? "cards" : "questions"} ·{" "}
                    {new Date(s.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="mt-5 flex gap-3 border-t border-[var(--sidebar-border)] pt-4">
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-12 flex-1 gap-1.5 bg-gradient-to-r from-violet-600/90 to-indigo-600/90 text-base font-medium text-[var(--inverse-text)] shadow-md shadow-violet-900/20 transition hover:from-violet-500 hover:to-indigo-500 sm:min-h-10 sm:text-sm"
                    onClick={() => router.push(`/study-sets/set/${encodeURIComponent(s.id)}`)}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Open
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-12 min-w-12 shrink-0 border border-[var(--border)] px-0 text-[var(--text)] hover:border-purple-500/35 hover:bg-purple-500/10 hover:text-[var(--text)] sm:min-h-10 sm:min-w-12 sm:px-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareStudySetId(s.id);
                    }}
                    aria-label="Share study set"
                    title="Share"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-12 min-w-12 shrink-0 border border-[var(--border)] px-0 text-[var(--muted)] hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200 sm:min-h-10 sm:min-w-10 sm:px-3"
                    disabled={deletingId === s.id}
                    onClick={(e) => void handleDelete(s.id, e)}
                    aria-label="Delete study set"
                  >
                    {deletingId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
            )}
          </>
        )}
      </main>
      {linkCopiedToast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--chrome-90)] px-4 py-2.5 text-sm text-[var(--text)] shadow-lg backdrop-blur">
          Link copied!
        </div>
      ) : null}
      {shareStudySetId ? (
        <ShareResourceModal
          open
          onClose={() => setShareStudySetId(null)}
          resourceType="study_set"
          resourceId={shareStudySetId}
          title="Share study set"
          onCopied={() => setLinkCopiedToast(true)}
        />
      ) : null}
    </div>
  );
}
