"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Bookmark, Loader2, Trash2, BookOpen, X } from "lucide-react";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { Button, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Note, StudySetSummary } from "@/lib/api-types";

export function StudySetsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [sets, setSets] = React.useState<StudySetSummary[]>([]);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [setsRes, notesRes] = await Promise.all([
        fetch("/api/study-sets", { credentials: "include" }),
        fetch("/api/notes", { credentials: "include" }),
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
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

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
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="relative min-h-dvh max-w-[100vw] overflow-x-hidden bg-[#0a0a0f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/14 via-blue-500/10 to-fuchsia-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/[0.06] bg-[#08080c]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Link
              href="/notes"
              className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl px-3 py-2 text-base text-white/55 transition duration-200 hover:bg-white/[0.05] hover:text-white/90 sm:min-h-0 sm:px-2 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Notes
            </Link>
            <div className="hidden h-8 w-px bg-white/[0.08] sm:block" aria-hidden />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-br from-purple-500/25 to-indigo-500/15">
                  <Bookmark className="h-4 w-4 text-purple-200/90" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white">Study sets</h1>
                  <p className="mt-0.5 text-sm text-white/45">Saved flashcards and quizzes</p>
                </div>
              </div>
            </div>
          </div>
          <StudaraWordmarkLink href="/notes" />
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
              className="shrink-0 rounded-lg p-1 text-red-300 transition hover:bg-red-500/20 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-9 w-9 animate-spin text-white/35" />
          </div>
        ) : sets.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-white/[0.06] bg-white/[0.03] px-8 py-16 text-center backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/15 to-blue-500/10">
              <Bookmark className="h-8 w-8 text-white/35" />
            </div>
            <p className="mt-6 text-lg font-medium text-white/90">No saved sets yet</p>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Generate flashcards or a quiz from a note, then save from study mode.
            </p>
            <Link
              href="/notes"
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-purple-500 hover:to-blue-500"
            >
              Back to notes
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((s) => (
              <div
                key={s.id}
                className="group flex min-h-[200px] flex-col rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 shadow-sm transition duration-200 hover:border-purple-500/25 hover:bg-white/[0.06]"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <h2 className="line-clamp-2 text-base font-semibold leading-snug text-white">{s.title}</h2>
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
                  <p className="text-xs leading-relaxed text-white/50">
                    <span className="text-white/35">Source · </span>
                    {sourceLabel(s)}
                  </p>
                  <p className="text-xs text-white/35">
                    {s.item_count} {s.kind === "flashcards" ? "cards" : "questions"} ·{" "}
                    {new Date(s.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="mt-5 flex gap-3 border-t border-white/[0.06] pt-4">
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-12 flex-1 gap-1.5 bg-gradient-to-r from-violet-600/90 to-indigo-600/90 text-base font-medium text-white shadow-md shadow-violet-900/20 transition hover:from-violet-500 hover:to-indigo-500 sm:min-h-10 sm:text-sm"
                    onClick={() => router.push(`/notes?openStudySet=${encodeURIComponent(s.id)}`)}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Open
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-12 min-w-12 shrink-0 border border-white/10 px-0 text-white/70 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200 sm:min-h-10 sm:min-w-10 sm:px-3"
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
      </main>
    </div>
  );
}
