"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useNotesRemote } from "@/lib/use-notes-remote";
import { SignoutButton } from "@/components/signout-button";
import { CreateCategoryModal } from "@/components/create-category-modal";
import { DeleteCategoryModal } from "@/components/delete-category-modal";
import { DeleteNoteModal } from "@/components/delete-note-modal";
import { Button, Card, Input, Textarea, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { sanitizeGeneratedNoteTitle } from "@/lib/sanitize-note-title";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import type { Note, Category, StudySetSummary } from "@/lib/api-types";
import { buildStudySetTitleFromNoteTitles } from "@/lib/study-set-utils";
import {
  Plus,
  Search,
  Pin,
  MessageCircle,
  FileText,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Download,
  BookOpen,
  Send,
  Loader2,
  Tag,
  GraduationCap,
  UserCircle,
  Trash2,
  Library,
  SquareStack,
  HelpCircle,
  Save,
} from "lucide-react";

const PRO_FEATURE_DESCRIPTIONS: Record<string, string> = {
  study: "Study Mode turns your notes into flashcards and quizzes. Generate practice questions and test your knowledge with AI.",
  chat: "AI Chat lets you ask questions across all your notes. Get answers powered by your entire knowledge base.",
  export: "Export your notes as PDF or Markdown for sharing, printing, or use in other apps.",
  semantic: "Semantic search finds notes by meaning, not just keywords. Search for concepts and ideas.",
  writing: "The Writing Assistant expands bullet points into full paragraphs and improves clarity and structure.",
  autoCategorize: "Auto-categorization suggests the best category for your note using AI.",
};

export function NoteApp({ userId }: { userId: string }) {
  const {
    categories,
    notes,
    loading,
    plan,
    proHeavyUsage,
    refreshPlan,
    upgradeModal,
    setUpgradeModal,
    categoryError,
    clearCategoryError,
    actions,
    FREE_NOTE_LIMIT,
  } = useNotesRemote(userId);

  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | "all" | null>(null);
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = React.useState("");
  const [chatLoading, setChatLoading] = React.useState(false);
  type StudyModalState =
    | { kind: "single"; noteId: string }
    | { kind: "multi"; noteIds: string[] }
    | { kind: "saved"; setId: string; title: string };
  const [studyModal, setStudyModal] = React.useState<StudyModalState | null>(null);
  const [savedStudySets, setSavedStudySets] = React.useState<StudySetSummary[]>([]);
  const [gridSelectMode, setGridSelectMode] = React.useState(false);
  const [gridSelectedIds, setGridSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [multiStudyError, setMultiStudyError] = React.useState<string | null>(null);
  const [studyMode, setStudyMode] = React.useState<"menu" | "flashcards" | "quiz">("menu");
  const [flashcards, setFlashcards] = React.useState<{ front: string; back: string }[]>([]);
  const [quizQuestions, setQuizQuestions] = React.useState<
    { question: string; options: string[]; correctIndex: number; explanation?: string }[]
  >([]);
  const [quizIndex, setQuizIndex] = React.useState(0);
  const [quizScore, setQuizScore] = React.useState<number | null>(null);
  const [quizSelected, setQuizSelected] = React.useState<number | null>(null);
  const [cardIndex, setCardIndex] = React.useState(0);
  const [cardFlipped, setCardFlipped] = React.useState(false);
  const [exportMenu, setExportMenu] = React.useState<string | null>(null);
  const [suggestBanner, setSuggestBanner] = React.useState<{ categoryId: string; name: string } | null>(null);
  const [newNoteIds, setNewNoteIds] = React.useState<Set<string>>(new Set());
  const [writingUndo, setWritingUndo] = React.useState<{ prev: string } | null>(null);
  const [summaryCache, setSummaryCache] = React.useState<Record<string, string>>({});
  const [summaryLoading, setSummaryLoading] = React.useState<Set<string>>(new Set());
  const [semanticIds, setSemanticIds] = React.useState<string[]>([]);
  const [draftNote, setDraftNote] = React.useState<Note | null>(null);
  const [summaryBelow, setSummaryBelow] = React.useState<string | null>(null);
  const [summarizeLoading, setSummarizeLoading] = React.useState(false);
  const [writingLoading, setWritingLoading] = React.useState(false);
  const [autoCategorizeLoading, setAutoCategorizeLoading] = React.useState(false);
  const [studyLoading, setStudyLoading] = React.useState<"flashcards" | "quiz" | null>(null);
  const [studySaveLoading, setStudySaveLoading] = React.useState<"flashcards" | "quiz" | null>(null);
  const [studyError, setStudyError] = React.useState<string | null>(null);
  const [improveLoading, setImproveLoading] = React.useState(false);
  const [extractLoading, setExtractLoading] = React.useState(false);
  const [titleLoading, setTitleLoading] = React.useState(false);
  const [tagsLoading, setTagsLoading] = React.useState(false);
  const [extractTasksModal, setExtractTasksModal] = React.useState<string[] | null>(null);
  const [suggestTagsChips, setSuggestTagsChips] = React.useState<string[] | null>(null);
  const [toolbarError, setToolbarError] = React.useState<string | null>(null);
  const [improveToast, setImproveToast] = React.useState(false);
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = React.useState(false);
  const [createCategoryLoading, setCreateCategoryLoading] = React.useState(false);
  const [deleteCategoryModal, setDeleteCategoryModal] = React.useState<{ id: string; name: string } | null>(null);
  const [deleteNoteModal, setDeleteNoteModal] = React.useState<{
    id: string;
    title?: string;
    fromEditor?: boolean;
  } | null>(null);
  const [deleteNoteLoading, setDeleteNoteLoading] = React.useState(false);

  const refreshStudySets = React.useCallback(async () => {
    try {
      const res = await fetch("/api/study-sets");
      if (!res.ok) return;
      const json = (await res.json()) as { sets?: StudySetSummary[] };
      setSavedStudySets(Array.isArray(json.sets) ? json.sets : []);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (!loading && userId) void refreshStudySets();
  }, [loading, userId, refreshStudySets]);

  const defaultCategoryId = categories[0]?.id ?? null;
  React.useEffect(() => {
    if (selectedCategoryId === null && defaultCategoryId) {
      setSelectedCategoryId("all");
    }
  }, [defaultCategoryId, selectedCategoryId]);

  const selectedCategoryIdRef = React.useRef(selectedCategoryId);
  React.useEffect(() => {
    selectedCategoryIdRef.current = selectedCategoryId;
  }, [selectedCategoryId]);

  const hasBootstrapped = React.useRef(false);
  React.useEffect(() => {
    if (!loading && categories.length === 0 && userId && !hasBootstrapped.current) {
      hasBootstrapped.current = true;
      actions.createCategory("General").then((c) => c && setSelectedCategoryId(c.id));
    }
  }, [loading, categories.length, userId]);

  const filteredNotes = React.useMemo(() => {
    let list = notes;
    if (selectedCategoryId && selectedCategoryId !== "all") {
      list = list.filter((n) => n.category_id === selectedCategoryId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (plan === "pro" && semanticIds.length > 0) {
        return list.filter((n) => semanticIds.includes(n.id)).sort((a, b) => {
          const ai = semanticIds.indexOf(a.id);
          const bi = semanticIds.indexOf(b.id);
          if (ai >= 0 && bi >= 0) return ai - bi;
          if (ai >= 0) return -1;
          if (bi >= 0) return 1;
          return 0;
        });
      }
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const aTime = a.updated_at ?? a.created_at ?? "";
      const bTime = b.updated_at ?? b.created_at ?? "";
      return bTime.localeCompare(aTime);
    });
  }, [notes, selectedCategoryId, searchQuery, plan, semanticIds]);

  React.useEffect(() => {
    if (!searchQuery.trim() || plan !== "pro") {
      setSemanticIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/search/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (cancelled) return;
      const json = (await res.json()) as { notes?: { id: string }[] };
      if (res.ok && json.notes) {
        setSemanticIds(json.notes.map((n) => n.id));
      } else {
        setSemanticIds([]);
      }
    })();
    return () => { cancelled = true; };
  }, [searchQuery, plan]);

  const selectedNote =
    selectedNoteId && draftNote && selectedNoteId === draftNote.id
      ? draftNote
      : selectedNoteId
        ? notes.find((n) => n.id === selectedNoteId) ?? null
        : null;
  const [editTitle, setEditTitle] = React.useState("");
  const [editContent, setEditContent] = React.useState("");
  const editTitleRef = React.useRef(editTitle);
  const editContentRef = React.useRef(editContent);
  const skipSyncRef = React.useRef(false);
  React.useEffect(() => {
    editTitleRef.current = editTitle;
    editContentRef.current = editContent;
  }, [editTitle, editContent]);
  React.useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    if (selectedNote && !draftNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content);
    }
  }, [selectedNote?.id, selectedNote?.title, selectedNote?.content, draftNote]);

  const studySourceLabel = React.useMemo(() => {
    if (!studyModal) return "Untitled";
    if (studyModal.kind === "saved") return studyModal.title;
    if (studyModal.kind === "multi") {
      const titles = studyModal.noteIds.map((id) => notes.find((n) => n.id === id)?.title);
      return buildStudySetTitleFromNoteTitles(titles);
    }
    const nid = studyModal.noteId;
    if (draftNote && nid === draftNote.id) return (editTitle ?? "Untitled").trim() || "Untitled";
    return (notes.find((n) => n.id === nid)?.title ?? "Untitled").trim() || "Untitled";
  }, [studyModal, notes, draftNote, editTitle]);

  const studyPayloadNoteIds = React.useMemo((): string[] => {
    if (!studyModal) return [];
    if (studyModal.kind === "multi") return studyModal.noteIds.filter((id) => !id.startsWith("draft-"));
    if (studyModal.kind === "single") {
      const nid = studyModal.noteId;
      if (nid.startsWith("draft-")) return [];
      return [nid];
    }
    return [];
  }, [studyModal]);

  const saveFlashcardSetToSupabase = React.useCallback(async () => {
    if (!studyModal || studyModal.kind === "saved" || flashcards.length === 0) return;
    setStudySaveLoading("flashcards");
    setStudyError(null);
    try {
      const title = `Flashcards — ${studySourceLabel}`;
      const res = await fetch("/api/study-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "flashcards",
          title,
          note_id: studyPayloadNoteIds[0] ?? null,
          note_ids: studyPayloadNoteIds,
          payload: { cards: flashcards },
        }),
      });
      const j = (await res.json()) as { error?: string; code?: string };
      if (res.status === 402) {
        setUpgradeModal({ show: true, feature: "study" });
        return;
      }
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      void refreshStudySets();
    } catch (e) {
      setStudyError(e instanceof Error ? e.message : "Could not save study set");
    } finally {
      setStudySaveLoading(null);
    }
  }, [studyModal, flashcards, studySourceLabel, studyPayloadNoteIds, refreshStudySets]);

  const saveQuizSetToSupabase = React.useCallback(async () => {
    if (!studyModal || studyModal.kind === "saved" || quizQuestions.length === 0) return;
    setStudySaveLoading("quiz");
    setStudyError(null);
    try {
      const title = `Quiz — ${studySourceLabel}`;
      const res = await fetch("/api/study-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "quiz",
          title,
          note_id: studyPayloadNoteIds[0] ?? null,
          note_ids: studyPayloadNoteIds,
          payload: { questions: quizQuestions },
        }),
      });
      const j = (await res.json()) as { error?: string; code?: string };
      if (res.status === 402) {
        setUpgradeModal({ show: true, feature: "study" });
        return;
      }
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      void refreshStudySets();
    } catch (e) {
      setStudyError(e instanceof Error ? e.message : "Could not save study set");
    } finally {
      setStudySaveLoading(null);
    }
  }, [studyModal, quizQuestions, studySourceLabel, studyPayloadNoteIds, refreshStudySets]);

  React.useEffect(() => {
    setSummaryBelow(null);
  }, [selectedNoteId]);

  const saveDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!selectedNoteId || !selectedNote || draftNote) return;
    saveDebounce.current = setTimeout(() => {
      actions.update(selectedNoteId, { title: editTitle, content: editContent });
      if (newNoteIds.has(selectedNoteId) && editContent.trim().length > 50 && plan === "pro") {
        const catIds = categories.map((c) => c.id);
        const catNames = categories.map((c) => c.name);
        fetch("/api/ai/anthropic/suggest-category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: editContent,
            categoryIds: catIds,
            categoryNames: catNames,
          }),
        })
          .then((r) => r.json())
          .then((j: { category?: { id: string; name: string } }) => {
            if (j.category && !suggestBanner) {
              setSuggestBanner({ categoryId: j.category.id, name: j.category.name });
            }
          })
          .catch(() => {});
        setNewNoteIds((prev) => {
          const next = new Set(prev);
          next.delete(selectedNoteId);
          return next;
        });
      }
    }, 500);
    return () => {
      if (saveDebounce.current) clearTimeout(saveDebounce.current);
    };
  }, [editTitle, editContent, selectedNoteId, selectedNote, draftNote, actions, categories, plan, newNoteIds, suggestBanner]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleNewNote();
      }
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        (document.querySelector('[data-search-input]') as HTMLInputElement)?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [defaultCategoryId, categories, notes, plan]);

  function handleNewNote() {
    if (plan !== "pro" && notes.length >= FREE_NOTE_LIMIT) {
      setUpgradeModal({ show: true, message: "You've reached the free limit — upgrade to Pro for unlimited notes" });
      return;
    }
    const sid = selectedCategoryIdRef.current;
    /** Sidebar category filter: specific id, or "all" / null → uncategorized */
    const targetCategoryId: string | null = sid && sid !== "all" ? sid : null;

    const draftId = `draft-${Date.now()}`;
    const draft: Note = {
      id: draftId,
      user_id: userId,
      category_id: targetCategoryId,
      title: "Untitled",
      content: "",
      pinned: false,
      tags: [],
    };
    setDraftNote(draft);
    setSelectedNoteId(draftId);
    setEditTitle("Untitled");
    setEditContent("");
    setNewNoteIds((prev) => new Set(prev).add(draftId));

    // Persist in background — don't block the editor
    (async () => {
      const note = await actions.create(targetCategoryId, "Untitled");
      if (note) {
        setNewNoteIds((prev) => {
          const next = new Set(prev);
          next.delete(draftId);
          next.add(note.id);
          return next;
        });
        skipSyncRef.current = true;
        actions.update(note.id, {
          title: editTitleRef.current,
          content: editContentRef.current,
        });
        setSelectedNoteId(note.id);
        setSelectedCategoryId(note.category_id ?? "all");
        setDraftNote(null);
      }
    })();
  }

  /** Sidebar category pick: leave note editor and show the grid for that category. */
  function selectSidebarCategory(categoryId: string | "all") {
    setSelectedCategoryId(categoryId);
    setSelectedNoteId(null);
    setDraftNote(null);
    setChatOpen(false);
    setStudyModal(null);
    setSuggestBanner(null);
    exitGridSelection();
  }

  async function confirmDeleteNote() {
    if (!deleteNoteModal) return;
    const { id } = deleteNoteModal;
    setDeleteNoteLoading(true);
    try {
      if (id.startsWith("draft-")) {
        setDraftNote(null);
        setSelectedNoteId(null);
        setNewNoteIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setExportMenu((m) => (m === id ? null : m));
        if (studyModal?.kind === "single" && studyModal.noteId === id) setStudyModal(null);
        if (studyModal?.kind === "multi" && studyModal.noteIds.includes(id)) setStudyModal(null);
        setDeleteNoteModal(null);
        return;
      }
      const ok = await actions.delete(id);
      if (!ok) return;
      setSelectedNoteId(null);
      setDraftNote(null);
      setSummaryCache((c) => {
        const next = { ...c };
        delete next[id];
        return next;
      });
      setSemanticIds((ids) => ids.filter((x) => x !== id));
      setExportMenu((m) => (m === id ? null : m));
      if (studyModal?.kind === "single" && studyModal.noteId === id) setStudyModal(null);
      if (studyModal?.kind === "multi" && studyModal.noteIds.includes(id)) setStudyModal(null);
      setGridSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleteNoteModal(null);
    } finally {
      setDeleteNoteLoading(false);
    }
  }

  function exitGridSelection() {
    setGridSelectMode(false);
    setGridSelectedIds(new Set());
    setMultiStudyError(null);
  }

  function startGridSelection() {
    setGridSelectMode(true);
    setGridSelectedIds(new Set());
    setMultiStudyError(null);
  }

  function toggleGridNoteSelected(noteId: string) {
    setGridSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  async function generateMultiStudy(kind: "flashcards" | "quiz") {
    setMultiStudyError(null);
    const ids = [...gridSelectedIds].filter((id) => !id.startsWith("draft-"));
    if (ids.length === 0) {
      setMultiStudyError("Select at least one note.");
      return;
    }
    setStudyError(null);
    setStudyLoading(kind);
    try {
      const res = await fetch("/api/study/multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, noteIds: ids }),
      });
      const json = (await res.json()) as {
        cards?: { front: string; back: string }[];
        questions?: { question: string; options: string[]; correctIndex: number }[];
        code?: string;
        error?: string;
      };
      if (json?.code === "FREE_LIMIT_STUDY_MULTIPLE" && res.status === 402) {
        setUpgradeModal({
          show: true,
          message:
            "You've used your free Study Multiple session this month — upgrade to Pro for unlimited multi-note study sessions.",
        });
        return;
      }
      if (json?.code && res.status === 402) {
        setUpgradeModal({ show: true, feature: "study" });
        return;
      }
      if (!res.ok) {
        setMultiStudyError(json.error ?? "Generation failed");
        return;
      }
      if (kind === "flashcards") {
        setFlashcards(json.cards ?? []);
        setStudyMode("flashcards");
        setCardIndex(0);
        setCardFlipped(false);
      } else {
        setQuizQuestions(json.questions ?? []);
        setStudyMode("quiz");
        setQuizIndex(0);
        setQuizScore(null);
        setQuizSelected(null);
      }
      setStudyModal({ kind: "multi", noteIds: ids });
      exitGridSelection();
      void refreshStudySets();
    } catch {
      setMultiStudyError(kind === "flashcards" ? "Failed to generate flashcards" : "Failed to generate quiz");
    } finally {
      setStudyLoading(null);
    }
  }

  async function openSavedStudySet(row: StudySetSummary) {
    setStudyError(null);
    setStudyLoading(row.kind === "flashcards" ? "flashcards" : "quiz");
    try {
      const res = await fetch(`/api/study-sets/${row.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        kind: "flashcards" | "quiz";
        title?: string;
        payload: { cards?: { front: string; back: string }[]; questions?: { question: string; options: string[]; correctIndex: number }[] };
      };
      if (data.kind === "flashcards") {
        setFlashcards(data.payload?.cards ?? []);
        setStudyMode("flashcards");
        setCardIndex(0);
        setCardFlipped(false);
      } else {
        setQuizQuestions(data.payload?.questions ?? []);
        setStudyMode("quiz");
        setQuizIndex(0);
        setQuizScore(null);
        setQuizSelected(null);
      }
      setStudyModal({ kind: "saved", setId: row.id, title: data.title ?? row.title });
    } catch {
      setStudyError("Could not open study set");
    } finally {
      setStudyLoading(null);
    }
  }

  async function deleteSavedStudySet(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/study-sets/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    if (studyModal?.kind === "saved" && studyModal.setId === id) {
      setStudyModal(null);
      setStudyMode("menu");
      setFlashcards([]);
      setQuizQuestions([]);
      setCardIndex(0);
      setCardFlipped(false);
      setQuizIndex(0);
      setQuizScore(null);
      setQuizSelected(null);
      setStudyLoading(null);
      setStudyError(null);
    }
    void refreshStudySets();
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh bg-[#0a0a0f]">
      {/* Background gradient (landing-style) */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/15 via-blue-500/10 to-fuchsia-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/5 via-purple-600/10 to-emerald-500/5 blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside className="relative z-20 flex h-dvh w-64 flex-shrink-0 flex-col border-r border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="flex shrink-0 flex-col gap-2 border-b border-white/10 p-4">
          <StudaraWordmarkLink href="/notes" />
          <div className="text-xs text-white/60">AI note-taking</div>
        </div>
        <div className="flex shrink-0 flex-col p-3">
          <button
            onClick={handleNewNote}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-purple-500 hover:to-blue-500"
          >
            <Plus className="h-4 w-4" />
            New Note
          </button>
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
            <Search className="h-4 w-4 shrink-0 text-white/50" />
            <input
              data-search-input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            />
          </div>
          {categoryError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              <span>{categoryError}</span>
              <button onClick={clearCategoryError} className="shrink-0 text-red-300 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Categories</div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <div className="space-y-0.5">
            <CategoryTab
              id="all"
              name="All Notes"
              selected={selectedCategoryId === "all"}
              onClick={() => selectSidebarCategory("all")}
            />
            {categories.map((c) => (
              <CategoryTab
                key={c.id}
                id={c.id}
                name={c.name}
                color={c.color}
                selected={selectedCategoryId === c.id}
                onClick={() => selectSidebarCategory(c.id)}
                onRename={() => {
                  const name = prompt("Rename category:", c.name);
                  if (name?.trim()) actions.updateCategory(c.id, name.trim());
                }}
                onDelete={() => setDeleteCategoryModal({ id: c.id, name: c.name })}
              />
            ))}
            <button
              onClick={() => {
                clearCategoryError();
                setCreateCategoryModalOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-white/60 hover:bg-white/5 hover:text-white/80"
            >
              <Plus className="h-3.5 w-3.5" />
              Add category
            </button>
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-white/50">
              <Library className="h-3.5 w-3.5" />
              Study Sets
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {savedStudySets.length === 0 ? (
                <p className="px-2 py-1 text-xs text-white/40">No saved sets yet</p>
              ) : (
                savedStudySets.map((s) => (
                  <div
                    key={s.id}
                    className="group flex w-full items-start gap-1 rounded-lg border border-transparent px-1.5 py-1.5 text-left transition hover:border-white/10 hover:bg-white/5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setChatOpen(false);
                        void openSavedStudySet(s);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="line-clamp-2 text-xs font-medium text-white/90">{s.title}</span>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge
                          className={cn(
                            "border-0 text-[10px] font-medium",
                            s.kind === "flashcards"
                              ? "bg-violet-500/20 text-violet-200"
                              : "bg-cyan-500/15 text-cyan-200"
                          )}
                        >
                          {s.kind === "flashcards" ? "Flashcards" : "Quiz"}
                        </Badge>
                        <span className="text-[10px] text-white/45">
                          {s.item_count} {s.kind === "flashcards" ? "cards" : "questions"}
                        </span>
                      </div>
                      <span className="mt-1 block text-[10px] text-white/40">
                        {new Date(s.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deleteSavedStudySet(s.id, e)}
                      className="shrink-0 rounded p-1 text-white/40 transition hover:bg-red-500/20 hover:text-red-300"
                      title="Delete study set"
                      aria-label="Delete study set"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </nav>
        <div className="flex shrink-0 flex-col border-t border-white/10 p-3">
          {plan !== "pro" ? (
            <Link
              href="/billing"
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-purple-500 hover:to-blue-500"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </Link>
          ) : null}
          <Link
            href="/tutor"
            className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
          >
            <GraduationCap className="h-4 w-4" />
            AI Tutor
          </Link>
          <button
            onClick={async () => {
              if (plan !== "pro") {
                setUpgradeModal({ show: true, feature: "chat" });
                return;
              }
              setChatOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
          >
            <MessageCircle className="h-4 w-4" />
            AI Chat
          </button>
          <Link
            href="/profile"
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
          >
            <UserCircle className="h-4 w-4" />
            Profile
          </Link>
          <div className="mt-2">
            <SignoutButton />
          </div>
        </div>
      </aside>

      {/* Main content: grid of note cards OR editor panel */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {plan === "pro" && proHeavyUsage ? (
          <div
            role="status"
            className="shrink-0 border-b border-amber-400/25 bg-amber-500/15 px-4 py-2.5 text-center text-sm text-amber-50/95"
          >
            You&apos;re a heavy user this month — you may experience slightly slower responses as we manage server load.
          </div>
        ) : null}
        {selectedNoteId ? (
          /* Editor panel (full) */
          <div className="flex flex-1 flex-col overflow-hidden p-6">
          <EditorPanel
            selectedNote={selectedNote!}
            categories={categories}
            plan={plan}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            editContent={editContent}
            setEditContent={setEditContent}
            suggestBanner={suggestBanner}
            writingUndo={writingUndo}
            onBack={() => {
              if (draftNote) setDraftNote(null);
              setSelectedNoteId(null);
            }}
            onUpdate={(patch) => {
              if (draftNote && selectedNoteId === draftNote.id) {
                setDraftNote((d) => (d ? { ...d, ...patch } : null));
              } else if (selectedNoteId) {
                actions.update(selectedNoteId, patch);
              }
            }}
            onSuggestApply={() => {
              if (suggestBanner && selectedNote) {
                if (draftNote && selectedNote.id === draftNote.id) {
                  setDraftNote((d) => (d ? { ...d, category_id: suggestBanner!.categoryId } : null));
                } else {
                  actions.update(selectedNote.id, { category_id: suggestBanner.categoryId });
                }
                setSuggestBanner(null);
              }
            }}
            onSuggestDismiss={() => setSuggestBanner(null)}
            onWritingUndo={() => {
              if (selectedNoteId && writingUndo) {
                setEditContent(writingUndo.prev);
                if (!draftNote || selectedNoteId !== draftNote.id) {
                  actions.update(selectedNoteId, { content: writingUndo.prev });
                } else {
                  setDraftNote((d) => (d ? { ...d, content: writingUndo!.prev } : null));
                }
                setWritingUndo(null);
              }
            }}
            onWritingDismiss={() => setWritingUndo(null)}
            onSummarize={async () => {
              const res = await fetch("/api/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "summarize", content: editContent }),
              });
              const json = (await res.json()) as { result?: string };
              if (json.result) setEditContent((c) => c + "\n\n---\nSummary: " + json.result);
            }}
            onImprove={async () => {
              setToolbarError(null);
              setImproveLoading(true);
              try {
                const res = await fetch("/api/ai/anthropic/improve", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: editContent }),
                });
                const json = (await res.json()) as { improved?: string; error?: string; code?: string };
                if (json.code && res.status === 402) {
                  setUpgradeModal({ show: true, message: json.error ?? "You've used all 5 free improvements this month — upgrade to Pro for unlimited access." });
                  return;
                }
                if (json.improved) {
                  setEditContent(json.improved);
                  if (selectedNote && (draftNote?.id === selectedNote.id || !draftNote)) {
                    if (draftNote && selectedNote.id === draftNote.id) {
                      setDraftNote((d) => (d ? { ...d, content: json.improved! } : null));
                    } else {
                      actions.update(selectedNote.id, { content: json.improved });
                    }
                  }
                  setImproveToast(true);
                  setTimeout(() => setImproveToast(false), 3000);
                } else {
                  setToolbarError(json.error ?? "Failed to improve note");
                }
              } catch {
                setToolbarError("Something went wrong. Please try again.");
              } finally {
                setImproveLoading(false);
              }
            }}
            onExtract={async () => {
              setToolbarError(null);
              setExtractLoading(true);
              setExtractTasksModal(null);
              try {
                const res = await fetch("/api/ai/anthropic/extract-tasks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: editContent }),
                });
                const json = (await res.json()) as { tasks?: string[]; error?: string };
                if (json.tasks?.length) {
                  setExtractTasksModal(json.tasks);
                } else if (json.error) {
                  setToolbarError(json.error);
                } else {
                  setExtractTasksModal(["No tasks found in this note."]);
                }
              } catch {
                setToolbarError("Something went wrong. Please try again.");
              } finally {
                setExtractLoading(false);
              }
            }}
            onGenerateTitle={async () => {
              setToolbarError(null);
              setTitleLoading(true);
              try {
                const res = await fetch("/api/ai/anthropic/generate-title", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: editContent }),
                });
                const json = (await res.json()) as { title?: string; error?: string };
                if (json.title) {
                  const title = sanitizeGeneratedNoteTitle(json.title);
                  setEditTitle(title);
                  if (selectedNote && (draftNote?.id === selectedNote.id || !draftNote)) {
                    if (draftNote && selectedNote.id === draftNote.id) {
                      setDraftNote((d) => (d ? { ...d, title } : null));
                    } else {
                      actions.update(selectedNote.id, { title });
                    }
                  }
                } else {
                  setToolbarError(json.error ?? "Failed to generate title");
                }
              } catch {
                setToolbarError("Something went wrong. Please try again.");
              } finally {
                setTitleLoading(false);
              }
            }}
            onSuggestTags={async () => {
              setToolbarError(null);
              setTagsLoading(true);
              setSuggestTagsChips(null);
              try {
                const res = await fetch("/api/ai/anthropic/suggest-tags", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: editContent }),
                });
                const json = (await res.json()) as { tags?: string[]; error?: string };
                if (json.tags?.length) {
                  setSuggestTagsChips(json.tags);
                } else if (json.error) {
                  setToolbarError(json.error);
                } else {
                  setToolbarError("No tags could be suggested for this note.");
                }
              } catch {
                setToolbarError("Something went wrong. Please try again.");
              } finally {
                setTagsLoading(false);
              }
            }}
            onWritingAssistant={async () => {
              if (plan !== "pro") {
                setUpgradeModal({ show: true, feature: "writing" });
                return;
              }
              setWritingLoading(true);
              try {
                const res = await fetch("/api/ai/anthropic/expand-bullets", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: editContent }),
                });
                const json = (await res.json()) as { expanded?: string; code?: string; error?: string };
                if (json.code && res.status === 402) {
                  setUpgradeModal({ show: true, feature: "writing" });
                  return;
                }
                if (json.expanded && selectedNote) {
                  setWritingUndo({ prev: editContent });
                  setEditContent(json.expanded);
                  if (draftNote && selectedNote.id === draftNote.id) {
                    setDraftNote((d) => (d ? { ...d, content: json.expanded! } : null));
                  } else {
                    actions.update(selectedNote.id, { content: json.expanded });
                  }
                } else if (json.error) {
                  setUpgradeModal({ show: true, message: json.error });
                }
              } catch {
                setUpgradeModal({ show: true, message: "Writing assistant failed" });
              } finally {
                setWritingLoading(false);
              }
            }}
            writingLoading={writingLoading}
            onStudy={() => {
              if (plan !== "pro") {
                setUpgradeModal({ show: true, feature: "study" });
                return;
              }
              setStudyModal({ kind: "single", noteId: selectedNote!.id });
              setStudyMode("menu");
            }}
            onClaudeSummarize={async () => {
              setSummarizeLoading(true);
              setSummaryBelow(null);
              try {
                const res = await fetch("/api/ai/anthropic/summarize", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: editContent }),
                });
                const json = (await res.json()) as { summary?: string; code?: string; error?: string };
                if (json.code && res.status === 402) {
                  setUpgradeModal({ show: true, message: json.error ?? "Upgrade to Pro" });
                  return;
                }
                if (json.summary) setSummaryBelow(json.summary);
                else if (json.error) setSummaryBelow(`Error: ${json.error}`);
              } catch {
                setSummaryBelow("Error: Failed to summarize");
              } finally {
                setSummarizeLoading(false);
              }
            }}
            summaryBelow={summaryBelow}
            summaryLoading={summarizeLoading}
            onAutoCategorize={async () => {
              if (categories.length < 2) return;
              if (plan !== "pro") {
                setUpgradeModal({ show: true, feature: "autoCategorize" });
                return;
              }
              setAutoCategorizeLoading(true);
              setSuggestBanner(null);
              try {
                const res = await fetch("/api/ai/anthropic/suggest-category", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    content: editContent,
                    categoryIds: categories.map((c) => c.id),
                    categoryNames: categories.map((c) => c.name),
                  }),
                });
                const json = (await res.json()) as { category?: { id: string; name: string }; code?: string; error?: string };
                if (json.code && res.status === 402) {
                  setUpgradeModal({ show: true, feature: "autoCategorize" });
                  return;
                }
                if (json.category) setSuggestBanner({ categoryId: json.category.id, name: json.category.name });
                else if (json.error) setUpgradeModal({ show: true, message: json.error });
              } catch {
                setUpgradeModal({ show: true, message: "Failed to suggest category" });
              } finally {
                setAutoCategorizeLoading(false);
              }
            }}
            autoCategorizeLoading={autoCategorizeLoading}
            improveLoading={improveLoading}
            extractLoading={extractLoading}
            titleLoading={titleLoading}
            tagsLoading={tagsLoading}
            extractTasksModal={extractTasksModal}
            suggestTagsChips={suggestTagsChips}
            toolbarError={toolbarError}
            onExtractTasksClose={() => setExtractTasksModal(null)}
            onSuggestTagAccept={(tag) => {
              if (selectedNote) {
                const current = selectedNote.tags ?? [];
                const next = [...new Set([...current, tag])];
                if (draftNote && selectedNote.id === draftNote.id) {
                  setDraftNote((d) => (d ? { ...d, tags: next } : null));
                } else {
                  actions.update(selectedNote.id, { tags: next });
                }
              }
              setSuggestTagsChips((t) => (t ? t.filter((x) => x !== tag) : null));
            }}
            onSuggestTagDismiss={() => setSuggestTagsChips(null)}
            onToolbarErrorDismiss={() => setToolbarError(null)}
            setUpgradeModal={setUpgradeModal}
            onDeleteRequest={() => {
              if (selectedNote) {
                setDeleteNoteModal({
                  id: selectedNote.id,
                  title: selectedNote.title || "Untitled",
                  fromEditor: true,
                });
              }
            }}
          />
          </div>
        ) : (
          /* Grid of note cards */
          <div className="flex flex-1 flex-col overflow-hidden p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-semibold text-white">
                {gridSelectMode
                  ? "Select notes"
                  : selectedCategoryId === "all"
                    ? "All Notes"
                    : categories.find((c) => c.id === selectedCategoryId)?.name ?? "Notes"}
              </h1>
              {gridSelectMode ? (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-sm font-medium tabular-nums text-white/90">
                    {gridSelectedIds.size} selected
                  </span>
                  <Button
                    size="sm"
                    onClick={() => generateMultiStudy("flashcards")}
                    disabled={!!studyLoading || gridSelectedIds.size === 0}
                    className="gap-1.5"
                  >
                    {studyLoading === "flashcards" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    Generate Flashcards
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => generateMultiStudy("quiz")}
                    disabled={!!studyLoading || gridSelectedIds.size === 0}
                    className="gap-1.5"
                  >
                    {studyLoading === "quiz" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Generate Quiz
                  </Button>
                  <Button size="sm" variant="ghost" onClick={exitGridSelection} disabled={!!studyLoading}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    onClick={startGridSelection}
                    className="gap-1.5 border border-white/15 bg-white/10 text-white hover:bg-white/15"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Study Multiple
                  </Button>
                  <span className="text-sm text-white/50">⌘N new · ⌘K search</span>
                </div>
              )}
            </div>
            {multiStudyError && (
              <p className="mb-3 text-sm text-red-400">{multiStudyError}</p>
            )}
            {filteredNotes.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-12">
                <FileText className="h-12 w-12 text-white/30" />
                <p className="mt-4 text-white/60">No notes yet</p>
                <p className="mt-1 text-sm text-white/40">Click New Note to create your first note</p>
                <Button onClick={handleNewNote} className="mt-6">
                  <Plus className="mr-2 h-4 w-4" />
                  New Note
                </Button>
              </div>
            ) : (
              <div className="grid flex-1 content-start gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    categories={categories}
                    plan={plan}
                    selectMode={gridSelectMode}
                    selected={gridSelectedIds.has(note.id)}
                    onToggleSelect={() => toggleGridNoteSelected(note.id)}
                    summary={summaryCache[note.id]}
                    summaryLoading={summaryLoading.has(note.id)}
                    onSelect={() => setSelectedNoteId(note.id)}
                    onUpdateCategory={(catId) => actions.update(note.id, { category_id: catId })}
                    onTogglePin={() => actions.update(note.id, { pinned: !note.pinned })}
                    onRequestDelete={() =>
                      setDeleteNoteModal({ id: note.id, title: note.title || "Untitled" })
                    }
                    onSummarize={async () => {
                      setSummaryLoading((s) => new Set(s).add(note.id));
                      const res = await fetch("/api/ai/anthropic/summarize", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ content: note.content }),
                      });
                      setSummaryLoading((s) => {
                        const next = new Set(s);
                        next.delete(note.id);
                        return next;
                      });
                      const json = (await res.json()) as { summary?: string; code?: string; error?: string };
                      if (json.code && res.status === 402) {
                        setUpgradeModal({ show: true, message: json.error ?? "Upgrade to Pro" });
                        return;
                      }
                      if (json.summary) setSummaryCache((c) => ({ ...c, [note.id]: json.summary! }));
                    }}
                    onExportPdf={async () => {
                      if (plan !== "pro") {
                        setUpgradeModal({ show: true, feature: "export" });
                        return;
                      }
                      const { default: jsPDF } = await import("jspdf");
                      const doc = new jsPDF();
                      doc.setFontSize(16);
                      doc.text(note.title, 20, 20);
                      doc.setFontSize(11);
                      const lines = doc.splitTextToSize(note.content || "", 170);
                      doc.text(lines, 20, 30);
                      doc.save(`${note.title || "note"}.pdf`);
                    }}
                    onExportMd={() => {
                      if (plan !== "pro") {
                        setUpgradeModal({ show: true, feature: "export" });
                        return;
                      }
                      const blob = new Blob([`# ${note.title}\n\n${note.content || ""}`], { type: "text/markdown" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${note.title || "note"}.md`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                    onStudy={() => {
                      if (plan !== "pro") {
                        setUpgradeModal({ show: true, feature: "study" });
                        return;
                      }
                      setStudyModal({ kind: "single", noteId: note.id });
                      setStudyMode("menu");
                    }}
                    exportOpen={exportMenu === note.id}
                    onExportToggle={() => setExportMenu((m) => (m === note.id ? null : note.id))}
                    setUpgradeModal={setUpgradeModal}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Chat sidebar */}
      {chatOpen && (
        <div className="flex w-80 flex-col border-l border-white/10 bg-black/20">
          <div className="flex items-center justify-between border-b border-white/10 p-2">
            <span className="font-semibold text-white">AI Chat</span>
            <button onClick={() => setChatOpen(false)} className="text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  m.role === "user" ? "ml-4 bg-white/10" : "mr-4 bg-white/5"
                )}
              >
                {m.content}
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking…</span>
              </div>
            )}
          </div>
          <form
            className="flex gap-2 border-t border-white/10 p-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!chatInput.trim() || chatLoading) return;
              const msg = chatInput.trim();
              setChatInput("");
              setChatMessages((m) => [...m, { role: "user", content: msg }]);
              setChatLoading(true);
              setChatMessages((m) => [...m, { role: "assistant", content: "" }]);
              try {
                const res = await fetch("/api/ai/anthropic/chat/stream", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message: msg }),
                });
                if (!res.ok) {
                  const json = (await res.json()) as { code?: string; error?: string };
                  if (json.code && res.status === 402) {
                    setUpgradeModal({ show: true, feature: "chat" });
                  } else {
                    setChatMessages((m) => {
                      const next = [...m];
                      const last = next[next.length - 1];
                      if (last?.role === "assistant") next[next.length - 1] = { ...last, content: json.error ?? "Sorry, I couldn't respond." };
                      return next;
                    });
                  }
                  return;
                }
                const reader = res.body?.getReader();
                if (!reader) {
                  setChatMessages((m) => {
                    const next = [...m];
                    const last = next[next.length - 1];
                    if (last?.role === "assistant") next[next.length - 1] = { ...last, content: "Sorry, I couldn't respond." };
                    return next;
                  });
                  return;
                }
                const decoder = new TextDecoder();
                let full = "";
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split("\n");
                  for (const line of lines) {
                    if (line.startsWith("data: ")) {
                      const data = line.slice(6);
                      if (data === "[DONE]") continue;
                      try {
                        const parsed = JSON.parse(data) as { text?: string };
                        if (parsed.text) {
                          full += parsed.text;
                          setChatMessages((m) => {
                            const next = [...m];
                            const last = next[next.length - 1];
                            if (last?.role === "assistant") next[next.length - 1] = { ...last, content: full };
                            return next;
                          });
                        }
                      } catch {
                        // skip
                      }
                    }
                  }
                }
              } catch {
                setChatMessages((m) => {
                  const next = [...m];
                  const last = next[next.length - 1];
                  if (last?.role === "assistant") next[next.length - 1] = { ...last, content: "Sorry, I couldn't respond." };
                  return next;
                });
              } finally {
                setChatLoading(false);
                void refreshPlan();
              }
            }}
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about your notes..."
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
            />
            <Button type="submit" size="sm">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Study modal */}
      {studyModal && (
        <StudyModal
          studyScope={
            studyModal.kind === "saved" ? "saved" : studyModal.kind === "multi" ? "multi" : "single"
          }
          savedSetTitle={studyModal.kind === "saved" ? studyModal.title : undefined}
          mode={studyMode}
          flashcards={flashcards}
          quizQuestions={quizQuestions}
          cardIndex={cardIndex}
          cardFlipped={cardFlipped}
          quizIndex={quizIndex}
          quizScore={quizScore}
          quizSelected={quizSelected}
          loading={studyLoading}
          error={studyError}
          onClose={() => {
            setStudyModal(null);
            setStudyMode("menu");
            setFlashcards([]);
            setQuizQuestions([]);
            setCardIndex(0);
            setCardFlipped(false);
            setQuizIndex(0);
            setQuizScore(null);
            setQuizSelected(null);
            setStudyLoading(null);
            setStudySaveLoading(null);
            setStudyError(null);
          }}
          canPersistStudy={studyModal.kind !== "saved"}
          studySaveLoading={studySaveLoading}
          onSaveFlashcards={saveFlashcardSetToSupabase}
          onSaveQuiz={saveQuizSetToSupabase}
          onSelectMode={(m) => setStudyMode(m)}
          onLoadFlashcards={async () => {
            if (studyModal.kind !== "single") return;
            const nid = studyModal.noteId;
            setStudyError(null);
            setStudyLoading("flashcards");
            try {
              const res = await fetch(`/api/study/${nid}`);
              const json = (await res.json()) as { flashcards?: { cards?: { front: string; back: string }[] } | null; code?: string; error?: string };
              if (json?.code && res.status === 402) {
                setUpgradeModal({ show: true, feature: "study" });
                return;
              }
              const payload = json?.flashcards;
              const cards = (payload && typeof payload === "object" && "cards" in payload ? payload.cards : null) ?? null;
              if (cards?.length) {
                setFlashcards(cards);
                setStudyMode("flashcards");
              } else {
                const body: { kind: "flashcards"; content?: string; title?: string } = { kind: "flashcards" };
                if (draftNote && nid === draftNote.id) {
                  body.content = editContent;
                  body.title = editTitle;
                }
                const post = await fetch(`/api/study/${nid}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                const j = (await post.json()) as { cards?: { front: string; back: string }[]; code?: string; error?: string };
                if (j.code && post.status === 402) {
                  setUpgradeModal({ show: true, feature: "study" });
                  return;
                }
                if (j.error) setStudyError(j.error);
                setFlashcards(j.cards ?? []);
                setStudyMode("flashcards");
                void refreshStudySets();
              }
            } catch {
              setStudyError("Failed to generate flashcards");
            } finally {
              setStudyLoading(null);
            }
          }}
          onLoadQuiz={async () => {
            if (studyModal.kind !== "single") return;
            const nid = studyModal.noteId;
            setStudyError(null);
            setStudyLoading("quiz");
            try {
              const res = await fetch(`/api/study/${nid}`);
              const json = (await res.json()) as { quiz?: { questions?: { question: string; options: string[]; correctIndex: number }[] } | null; code?: string; error?: string };
              if (json?.code && res.status === 402) {
                setUpgradeModal({ show: true, feature: "study" });
                return;
              }
              const payload = json?.quiz;
              const qs = (payload && typeof payload === "object" && "questions" in payload ? payload.questions : null) ?? null;
              if (qs?.length) {
                setQuizQuestions(qs);
                setStudyMode("quiz");
              } else {
                const body: { kind: "quiz"; content?: string; title?: string } = { kind: "quiz" };
                if (draftNote && nid === draftNote.id) {
                  body.content = editContent;
                  body.title = editTitle;
                }
                const post = await fetch(`/api/study/${nid}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                const j = (await post.json()) as { questions?: { question: string; options: string[]; correctIndex: number }[]; code?: string; error?: string };
                if (j.code && post.status === 402) {
                  setUpgradeModal({ show: true, feature: "study" });
                  return;
                }
                if (j.error) setStudyError(j.error);
                setQuizQuestions(j.questions ?? []);
                setStudyMode("quiz");
                void refreshStudySets();
              }
            } catch {
              setStudyError("Failed to generate quiz");
            } finally {
              setStudyLoading(null);
            }
          }}
          onCardPrev={() => {
            setCardIndex((i) => Math.max(0, i - 1));
            setCardFlipped(false);
          }}
          onCardNext={() => {
            setCardIndex((i) => Math.min(flashcards.length - 1, i + 1));
            setCardFlipped(false);
          }}
          onCardFlip={() => setCardFlipped((f) => !f)}
          onQuizSelect={(i) => {
            if (quizSelected !== null) return;
            setQuizSelected(i);
            const q = quizQuestions[quizIndex];
            if (q && i === q.correctIndex) {
              setQuizScore((s) => (s ?? 0) + 1);
            }
          }}
          onQuizNext={() => {
            if (quizIndex < quizQuestions.length - 1) {
              setQuizIndex((i) => i + 1);
              setQuizSelected(null);
            } else {
              setQuizScore((s) => s ?? 0);
            }
          }}
          onQuizTryAgain={() => {
            setQuizIndex(0);
            setQuizScore(null);
            setQuizSelected(null);
          }}
        />
      )}

      {/* Upgrade modal */}
      {upgradeModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="mx-4 max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white">Upgrade to Pro</h3>
            <p className="mt-2 text-sm text-white/70">
              {upgradeModal.feature && PRO_FEATURE_DESCRIPTIONS[upgradeModal.feature]
                ? `${PRO_FEATURE_DESCRIPTIONS[upgradeModal.feature]} This feature is Pro only.`
                : upgradeModal.message ?? "Upgrade to Pro for more features."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/billing"
                onClick={() => setUpgradeModal({ show: false })}
                className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:from-purple-500 hover:to-blue-500"
              >
                <Sparkles className="h-4 w-4" />
                Upgrade to Pro
              </Link>
              <Button variant="ghost" onClick={() => setUpgradeModal({ show: false })}>
                Maybe later
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Improve toast */}
      {improveToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-black/90 px-4 py-2.5 text-sm text-white shadow-lg backdrop-blur">
          Notes improved
        </div>
      )}

      <DeleteNoteModal
        open={!!deleteNoteModal}
        loading={deleteNoteLoading}
        onClose={() => !deleteNoteLoading && setDeleteNoteModal(null)}
        onConfirm={confirmDeleteNote}
      />

      {/* Delete category modal */}
      <DeleteCategoryModal
        open={!!deleteCategoryModal}
        categoryName={deleteCategoryModal?.name ?? ""}
        onClose={() => setDeleteCategoryModal(null)}
        onConfirm={() => {
          if (deleteCategoryModal) {
            actions.deleteCategory(deleteCategoryModal.id);
            if (selectedCategoryId === deleteCategoryModal.id) setSelectedCategoryId("all");
          }
        }}
      />

      {/* Create category modal */}
      <CreateCategoryModal
        open={createCategoryModalOpen}
        onClose={() => setCreateCategoryModalOpen(false)}
        loading={createCategoryLoading}
        onCreate={async (name, color) => {
          setCreateCategoryLoading(true);
          try {
            const cat = await actions.createCategory(name, color);
            if (cat) setSelectedCategoryId(cat.id);
            return !!cat;
          } finally {
            setCreateCategoryLoading(false);
          }
        }}
      />
    </div>
  );
}

function EditorPanel({
  selectedNote,
  categories,
  plan,
  editTitle,
  setEditTitle,
  editContent,
  setEditContent,
  suggestBanner,
  writingUndo,
  summaryBelow,
  summaryLoading,
  autoCategorizeLoading,
  writingLoading,
  improveLoading,
  extractLoading,
  titleLoading,
  tagsLoading,
  extractTasksModal,
  suggestTagsChips,
  toolbarError,
  onBack,
  onUpdate,
  onSuggestApply,
  onSuggestDismiss,
  onWritingUndo,
  onWritingDismiss,
  onSummarize,
  onImprove,
  onExtract,
  onGenerateTitle,
  onSuggestTags,
  onWritingAssistant,
  onStudy,
  onClaudeSummarize,
  onAutoCategorize,
  onExtractTasksClose,
  onSuggestTagAccept,
  onSuggestTagDismiss,
  onToolbarErrorDismiss,
  setUpgradeModal,
  onDeleteRequest,
}: {
  selectedNote: Note;
  categories: Category[];
  plan: string;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editContent: string;
  setEditContent: (v: string) => void;
  suggestBanner: { categoryId: string; name: string } | null;
  writingUndo: { prev: string } | null;
  summaryBelow: string | null;
  summaryLoading: boolean;
  autoCategorizeLoading: boolean;
  writingLoading: boolean;
  improveLoading: boolean;
  extractLoading: boolean;
  titleLoading: boolean;
  tagsLoading: boolean;
  extractTasksModal: string[] | null;
  suggestTagsChips: string[] | null;
  toolbarError: string | null;
  onBack: () => void;
  onUpdate: (patch: Partial<Pick<Note, "title" | "content" | "category_id" | "tags">>) => void;
  onSuggestApply: () => void;
  onSuggestDismiss: () => void;
  onWritingUndo: () => void;
  onWritingDismiss: () => void;
  onSummarize: () => void;
  onImprove: () => void;
  onExtract: () => void;
  onGenerateTitle: () => void;
  onSuggestTags: () => void;
  onWritingAssistant: () => void;
  onStudy: () => void;
  onClaudeSummarize: () => void;
  onAutoCategorize: () => void;
  onExtractTasksClose: () => void;
  onSuggestTagAccept: (tag: string) => void;
  onSuggestTagDismiss: () => void;
  onToolbarErrorDismiss: () => void;
  setUpgradeModal: (x: { show: boolean; message?: string; feature?: string }) => void;
  onDeleteRequest: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-white/5 hover:text-white"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <select
            value={selectedNote.category_id ?? ""}
            onChange={(e) => onUpdate({ category_id: e.target.value || null })}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
          >
            {selectedNote.category_id === "pending" && !categories.some((c) => c.id === "pending") && (
              <option value="pending">General (creating…)</option>
            )}
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={onClaudeSummarize} disabled={summaryLoading}>
            {summaryLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Summarize
          </Button>
          {categories.length >= 2 && (
            <Button size="sm" variant="ghost" onClick={onAutoCategorize} disabled={autoCategorizeLoading}>
              {autoCategorizeLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Tag className="mr-1.5 h-3.5 w-3.5" />}
              Auto-categorize
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onStudy}>
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Study
          </Button>
          <Button size="sm" variant="ghost" onClick={onWritingAssistant} disabled={writingLoading}>
            {writingLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
            Writing assistant
          </Button>
        </div>
        <button
          type="button"
          onClick={onDeleteRequest}
          className="shrink-0 rounded-lg p-2 text-white/50 transition hover:bg-red-500/15 hover:text-red-300"
          title="Delete note"
          aria-label="Delete note"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {suggestBanner && (
        <div className="flex items-center justify-between border-b border-white/10 bg-purple-500/10 px-4 py-2 text-sm">
          <span className="text-white/90">
            We suggest: <strong>{suggestBanner.name}</strong> — Apply?
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={onSuggestApply}>Apply</Button>
            <Button size="sm" variant="ghost" onClick={onSuggestDismiss}>Dismiss</Button>
          </div>
        </div>
      )}
      {writingUndo && (
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2 text-sm">
          <span className="text-white/70">Writing assistant applied. Undo?</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={onWritingUndo}>Undo</Button>
            <Button size="sm" variant="ghost" onClick={onWritingDismiss}>Dismiss</Button>
          </div>
        </div>
      )}
      {/* Title */}
      <div className="border-b border-white/10 px-6 py-4">
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-white/40"
          placeholder="Note title"
        />
      </div>
      {/* Body */}
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="note-editor-scrollbar min-h-[300px] w-full flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-purple-500/40"
          placeholder="Write your note..."
        />
        {summaryBelow && (
          <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">Summary</p>
            <p className="mt-1 text-sm leading-relaxed text-white/90">{summaryBelow}</p>
          </div>
        )}
        {toolbarError && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-200">{toolbarError}</p>
            <button onClick={onToolbarErrorDismiss} className="text-red-300 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {suggestTagsChips && suggestTagsChips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/60">Suggested tags:</span>
            {suggestTagsChips.map((tag) => (
              <Badge
                key={tag}
                className="cursor-pointer text-xs transition hover:bg-purple-500/40"
                onClick={() => onSuggestTagAccept(tag)}
              >
                + {tag}
              </Badge>
            ))}
            <button
              onClick={onSuggestTagDismiss}
              className="rounded px-2 py-0.5 text-xs text-white/50 hover:text-white/80"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={onImprove} disabled={improveLoading}>
            {improveLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Improve
          </Button>
          <Button size="sm" variant="ghost" onClick={onExtract} disabled={extractLoading}>
            {extractLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Extract Tasks
          </Button>
          <Button size="sm" variant="ghost" onClick={onGenerateTitle} disabled={titleLoading}>
            {titleLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Generate Title
          </Button>
          <Button size="sm" variant="ghost" onClick={onSuggestTags} disabled={tagsLoading}>
            {tagsLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Suggest Tags
          </Button>
        </div>
      </div>
      {extractTasksModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Card className="mx-4 max-w-md p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Extracted Tasks</h3>
              <button onClick={onExtractTasksClose} className="text-white/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {extractTasksModal.map((task, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/90">
                  <span className="mt-0.5 text-purple-400">•</span>
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  categories,
  plan,
  selectMode = false,
  selected = false,
  onToggleSelect,
  summary,
  summaryLoading,
  onSelect,
  onUpdateCategory,
  onTogglePin,
  onRequestDelete,
  onSummarize,
  onExportPdf,
  onExportMd,
  onStudy,
  exportOpen,
  onExportToggle,
  setUpgradeModal,
}: {
  note: Note;
  categories: Category[];
  plan: string;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  summary?: string;
  summaryLoading: boolean;
  onSelect: () => void;
  onUpdateCategory: (id: string) => void;
  onTogglePin: () => void;
  onRequestDelete: () => void;
  onSummarize: () => void;
  onExportPdf: () => void;
  onExportMd: () => void;
  onStudy: () => void;
  exportOpen: boolean;
  onExportToggle: () => void;
  setUpgradeModal: (x: { show: boolean; message?: string; feature?: string }) => void;
}) {
  const category = note.category_id ? categories.find((c) => c.id === note.category_id) : null;
  const categoryName = category?.name ?? "Uncategorized";
  const categoryColor = category?.color;
  const date = note.updated_at ?? note.created_at ?? "";
  const formattedDate = date ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
  const preview = (note.content || "").replace(/\n/g, " ").slice(0, 120) + ((note.content?.length ?? 0) > 120 ? "…" : "");

  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number } | null>(null);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const pointerCloseRef = React.useRef<(() => void) | null>(null);

  function openMenuAt(clientX: number, clientY: number) {
    const pad = 8;
    const mw = 160;
    const mh = 48;
    const x = Math.max(pad, Math.min(clientX, window.innerWidth - mw - pad));
    const y = Math.max(pad, Math.min(clientY, window.innerHeight - mh - pad));
    setCtxMenu({ x, y });
  }

  React.useEffect(() => {
    if (!ctxMenu) return;
    const t = window.setTimeout(() => {
      const close = () => setCtxMenu(null);
      pointerCloseRef.current = close;
      document.addEventListener("pointerdown", close);
    }, 200);
    return () => {
      clearTimeout(t);
      if (pointerCloseRef.current) {
        document.removeEventListener("pointerdown", pointerCloseRef.current);
        pointerCloseRef.current = null;
      }
    };
  }, [ctxMenu]);

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartRef.current = null;
  }

  const card = (
    <div
      onClick={() => {
        if (selectMode) {
          onToggleSelect?.();
          return;
        }
        onSelect();
      }}
      onContextMenu={(e) => {
        if (selectMode) return;
        e.preventDefault();
        e.stopPropagation();
        openMenuAt(e.clientX, e.clientY);
      }}
      onTouchStart={(e) => {
        if (selectMode) return;
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY };
        longPressTimer.current = setTimeout(() => {
          openMenuAt(t.clientX, t.clientY);
        }, 550);
      }}
      onTouchMove={(e) => {
        const start = touchStartRef.current;
        if (!start) return;
        const t = e.touches[0];
        const dx = Math.abs(t.clientX - start.x);
        const dy = Math.abs(t.clientY - start.y);
        if (dx > 14 || dy > 14) clearLongPress();
      }}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
      className={cn(
        "group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-purple-500/30 hover:bg-white/10",
        selectMode ? "cursor-default" : "cursor-pointer",
        selected && selectMode && "border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30",
        categoryColor && "border-l-4"
      )}
      style={categoryColor ? { borderLeftColor: categoryColor } : undefined}
    >
      <div className="flex items-start gap-3">
        {selectMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-500"
            aria-label={selected ? "Deselect note" : "Select note"}
          />
        )}
        <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex-1 truncate font-semibold text-white">{note.title || "Untitled"}</h3>
        {!selectMode && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); onTogglePin(); }} className="rounded p-1 text-white/50 hover:text-amber-400">
            <Pin className={cn("h-3.5 w-3.5", note.pinned && "fill-amber-400 text-amber-400")} />
          </button>
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); onExportToggle(); }} className="rounded p-1 text-white/50 hover:text-white">
              <Download className="h-3.5 w-3.5" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-white/10 bg-black/95 py-1 shadow-xl">
                <button onClick={(e) => { e.stopPropagation(); onExportPdf(); }} className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10">
                  Export PDF
                </button>
                <button onClick={(e) => { e.stopPropagation(); onExportMd(); }} className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10">
                  Export Markdown
                </button>
              </div>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onStudy(); }} className="rounded p-1 text-white/50 hover:text-white">
            <BookOpen className="h-3.5 w-3.5" />
          </button>
        </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-white/60">{preview || "No content"}</p>
      <div className="mt-3 flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            categoryColor ? "text-white/90" : categoryName === "Uncategorized" ? "bg-white/10 text-white/60" : "bg-purple-500/20 text-purple-300"
          )}
          style={categoryColor ? { backgroundColor: `${categoryColor}30`, color: categoryColor } : undefined}
        >
          {categoryColor && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor }}
              aria-hidden
            />
          )}
          {categoryName}
        </span>
        <span className="text-xs text-white/50">{formattedDate}</span>
      </div>
      {(note.tags ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.map((t) => (
            <Badge key={t} className="text-xs">{t}</Badge>
          ))}
        </div>
      )}
      {summary && <p className="mt-2 line-clamp-2 text-xs text-white/50">{summary}</p>}
      {summaryLoading && <Loader2 className="mt-2 h-3 w-3 animate-spin text-white/50" />}
      {!selectMode && !summary && !summaryLoading && (
        <button
          onClick={(e) => { e.stopPropagation(); onSummarize(); }}
          className="mt-2 text-xs text-purple-400 hover:underline"
        >
          Summarize
        </button>
      )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {card}
      {ctxMenu && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[80] min-w-[160px] rounded-lg border border-white/10 bg-black/95 py-1 shadow-xl"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              onPointerDown={(e) => e.stopPropagation()}
              role="menu"
              aria-label="Note actions"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/10"
                onClick={() => {
                  onRequestDelete();
                  setCtxMenu(null);
                }}
              >
                Delete
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function CategoryTab({
  id,
  name,
  color,
  selected,
  onClick,
  onRename,
  onDelete,
}: {
  id: string;
  name: string;
  color?: string;
  selected: boolean;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const [menu, setMenu] = React.useState(false);
  const isAll = id === "all";
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
          selected ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white/90"
        )}
      >
        {color ? (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        ) : (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/20" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {!isAll && (onRename || onDelete) && (
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setMenu((m) => !m);
            }}
          />
        )}
      </button>
      {menu && !isAll && (
        <div className="absolute left-0 top-full z-10 mt-1 rounded-lg border border-white/10 bg-black/90 py-1 shadow-lg">
          {onRename && (
            <button onClick={() => { onRename(); setMenu(false); }} className="block w-full px-3 py-1.5 text-left text-sm text-white hover:bg-white/10">
              Rename
            </button>
          )}
          {onDelete && (
            <button onClick={() => { onDelete(); setMenu(false); }} className="block w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-white/10">
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function quizEncouragementMessage(score: number, total: number): string {
  if (total <= 0) return "Thanks for completing the quiz!";
  const pct = (score / total) * 100;
  if (pct >= 100) return "Perfect score — you've mastered this material!";
  if (pct >= 80) return "Excellent work — you're in great shape for the exam.";
  if (pct >= 60) return "Solid effort — review the tricky ones and you'll nail it.";
  if (pct >= 40) return "Keep going — every attempt builds stronger recall.";
  return "Don't give up — try again and watch your score climb.";
}

function StudyModal({
  studyScope = "single",
  savedSetTitle,
  mode,
  flashcards,
  quizQuestions,
  cardIndex,
  cardFlipped,
  quizIndex,
  quizScore,
  quizSelected,
  loading,
  error,
  onClose,
  onSelectMode: _onSelectMode,
  onLoadFlashcards,
  onLoadQuiz,
  onCardPrev,
  onCardNext,
  onCardFlip,
  onQuizSelect,
  onQuizNext,
  onQuizTryAgain,
  canPersistStudy,
  studySaveLoading,
  onSaveFlashcards,
  onSaveQuiz,
}: {
  studyScope?: "single" | "multi" | "saved";
  savedSetTitle?: string;
  mode: string;
  flashcards: { front: string; back: string }[];
  quizQuestions: { question: string; options: string[]; correctIndex: number; explanation?: string }[];
  cardIndex: number;
  cardFlipped: boolean;
  quizIndex: number;
  quizScore: number | null;
  quizSelected: number | null;
  loading: "flashcards" | "quiz" | null;
  error: string | null;
  onClose: () => void;
  onSelectMode: (m: "flashcards" | "quiz") => void;
  onLoadFlashcards: () => void;
  onLoadQuiz: () => void;
  onCardPrev: () => void;
  onCardNext: () => void;
  onCardFlip: () => void;
  onQuizSelect: (i: number) => void;
  onQuizNext: () => void;
  onQuizTryAgain: () => void;
  canPersistStudy: boolean;
  studySaveLoading: "flashcards" | "quiz" | null;
  onSaveFlashcards: () => void | Promise<void>;
  onSaveQuiz: () => void | Promise<void>;
}) {
  const q = quizQuestions[quizIndex];
  const total = quizQuestions.length;
  const done = quizIndex >= total - 1 && quizSelected !== null;
  const finalScore = quizScore ?? 0;

  if (mode === "menu") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
        <Card className="studara-study-modal-enter relative mx-auto w-full max-w-2xl border border-white/10 bg-[#0c0c12]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 ring-1 ring-white/10">
              <GraduationCap className="h-8 w-8 text-violet-200" strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">Study Mode</h2>
            <p className="mt-1.5 max-w-md text-sm text-white/55">
              Choose how you want to practice — flip through cards or test yourself with a quiz.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-2 text-white/45 transition hover:bg-white/10 hover:text-white sm:right-6 sm:top-6"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#12121a] p-5 shadow-inner sm:min-h-[220px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
                <SquareStack className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Flashcards</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-white/55">
                Key terms and definitions you can flip through at your own pace.
              </p>
              <Button
                type="button"
                onClick={onLoadFlashcards}
                disabled={!!loading}
                className="mt-5 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500"
              >
                {loading === "flashcards" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <SquareStack className="mr-2 h-4 w-4 opacity-90" />
                )}
                {loading === "flashcards" ? "Generating…" : "Start flashcards"}
              </Button>
            </div>

            <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#12121a] p-5 shadow-inner sm:min-h-[220px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
                <HelpCircle className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Quiz</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-white/55">
                Multiple choice questions to check your understanding and track progress.
              </p>
              <Button
                type="button"
                onClick={onLoadQuiz}
                disabled={!!loading}
                className="mt-5 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500"
              >
                {loading === "quiz" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <HelpCircle className="mr-2 h-4 w-4 opacity-90" />
                )}
                {loading === "quiz" ? "Generating…" : "Start quiz"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (mode === "flashcards" && flashcards.length > 0) {
    const card = flashcards[cardIndex];
    const totalCards = flashcards.length;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
        <Card className="mx-auto w-full max-w-lg border border-white/10 bg-[#0c0c12]/95 p-5 shadow-2xl backdrop-blur-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold tracking-tight text-white">Flashcards</h3>
              {studyScope === "multi" && (
                <p className="mt-1 text-xs text-violet-300/90">From multiple notes</p>
              )}
              {studyScope === "saved" && savedSetTitle && (
                <p className="mt-1 line-clamp-2 text-xs text-emerald-300/90">{savedSetTitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">{error}</p>
          )}

          <p className="mt-3 text-center text-xs text-white/45">Click the card to flip</p>

          {/* Fixed-size flip card: full width, min 200px height; gradient accent border */}
          <div className="mt-3 w-full">
            <div className="rounded-2xl bg-gradient-to-br from-violet-500/50 via-indigo-500/35 to-cyan-500/40 p-[1px] shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)]">
              <div className="perspective-[1400px] w-full">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={onCardFlip}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCardFlip();
                    }
                  }}
                  className={cn(
                    "relative min-h-[200px] w-full cursor-pointer transition-transform duration-500 ease-out [transform-style:preserve-3d]",
                    cardFlipped && "[transform:rotateY(180deg)]"
                  )}
                  aria-label={cardFlipped ? "Show question (front)" : "Show answer (back)"}
                >
                  {/* Front — term / question */}
                  <div
                    className="absolute inset-0 flex min-h-[200px] flex-col items-center justify-center overflow-y-auto rounded-[15px] border border-white/[0.08] bg-[#12121a] px-5 py-6 text-center [backface-visibility:hidden] [transform:rotateY(0deg)]"
                  >
                    <span className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-indigo-300">
                      Question
                    </span>
                    <p className="max-w-full text-base font-medium leading-relaxed text-white/95 [overflow-wrap:anywhere]">
                      {card.front}
                    </p>
                  </div>
                  {/* Back — definition / answer */}
                  <div
                    className="absolute inset-0 flex min-h-[200px] flex-col items-center justify-center overflow-y-auto rounded-[15px] border border-white/[0.08] bg-[#12121a] px-5 py-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]"
                  >
                    <span className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-300">
                      Answer
                    </span>
                    <p className="max-w-full text-base leading-relaxed text-white/90 [overflow-wrap:anywhere]">
                      {card.back}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-sm font-medium tabular-nums text-white/55">
            {cardIndex + 1} of {totalCards}
          </p>

          {canPersistStudy && (
            <Button
              type="button"
              className="mt-3 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-md shadow-violet-500/20 disabled:opacity-50"
              onClick={() => void onSaveFlashcards()}
              disabled={studySaveLoading === "flashcards"}
            >
              {studySaveLoading === "flashcards" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save flashcard set
            </Button>
          )}

          <div className="mt-3 flex w-full items-center justify-center gap-3">
            <Button
              type="button"
              variant="ghost"
              className="min-w-[7.5rem] border border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
              onClick={onCardPrev}
              disabled={cardIndex === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4 opacity-80" />
              Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-w-[7.5rem] border border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
              onClick={onCardNext}
              disabled={cardIndex === totalCards - 1}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4 opacity-80" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (mode === "quiz" && quizQuestions.length > 0 && q) {
    const pct = total > 0 ? Math.round((finalScore / total) * 100) : 0;
    const optionLetters = ["A", "B", "C", "D"];
    const paddedOptions = [...q.options];
    while (paddedOptions.length < 4) paddedOptions.push("");
    const fourOptions = paddedOptions.slice(0, 4);

    if (done) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
          <Card className="studara-study-modal-enter mx-auto w-full max-w-md border border-white/10 bg-[#0c0c12]/95 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/35 to-cyan-500/25 ring-1 ring-white/10">
              <GraduationCap className="h-8 w-8 text-violet-100" strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-white">Quiz complete</h2>
            <p className="mt-2 text-5xl font-bold tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-cyan-300">
              {finalScore}/{total}
            </p>
            <p className="mt-1 text-lg font-medium text-white/80">{pct}% correct</p>
            <p className="mt-4 text-sm leading-relaxed text-white/60">{quizEncouragementMessage(finalScore, total)}</p>
            {error && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>
            )}
            <div className="mt-8 flex flex-col gap-3">
              {canPersistStudy && (
                <Button
                  type="button"
                  className="w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-lg shadow-violet-500/25"
                  onClick={() => void onSaveQuiz()}
                  disabled={studySaveLoading === "quiz"}
                >
                  {studySaveLoading === "quiz" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save quiz
                </Button>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  onClick={onQuizTryAgain}
                  className="w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-md shadow-violet-500/20 sm:w-auto sm:min-w-[140px]"
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="w-full border border-white/15 bg-white/[0.06] text-white hover:bg-white/10 sm:w-auto sm:min-w-[140px]"
                >
                  Back to notes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    const showExplain = quizSelected !== null;
    const fallbackExplain =
      q.explanation?.trim() ||
      (showExplain
        ? quizSelected === q.correctIndex
          ? "That's the best answer — well done."
          : `The correct answer is (${optionLetters[q.correctIndex] ?? "?"}): ${fourOptions[q.correctIndex] || "—"}.`
        : null);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
        <Card className="mx-auto w-full max-w-lg border border-white/10 bg-[#0c0c12]/95 p-5 shadow-2xl backdrop-blur-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">Quiz</p>
              <p className="mt-1 text-sm font-medium tabular-nums text-white/70">
                Question {quizIndex + 1} of {total}
              </p>
              {studyScope === "multi" && (
                <p className="mt-1 text-xs text-violet-300/90">From multiple notes</p>
              )}
              {studyScope === "saved" && savedSetTitle && (
                <p className="mt-1 line-clamp-2 text-xs text-emerald-300/90">{savedSetTitle}</p>
              )}
              {error && (
                <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">{error}</p>
              )}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${((quizIndex + 1) / total) * 100}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 w-full">
            <div className="rounded-2xl bg-gradient-to-br from-violet-500/50 via-indigo-500/35 to-cyan-500/40 p-[1px] shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)]">
              <div className="flex min-h-[320px] flex-col rounded-[15px] border border-white/[0.08] bg-[#12121a] p-5 sm:min-h-[340px] sm:p-6">
                <h3 className="text-center text-base font-bold leading-snug text-white sm:text-lg [overflow-wrap:anywhere]">
                  {q.question}
                </h3>
                <div className="mt-5 flex flex-1 flex-col gap-2">
                  {fourOptions.map((opt, i) => {
                    const isCorrect = i === q.correctIndex;
                    const isPicked = quizSelected === i;
                    const revealed = quizSelected !== null;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onQuizSelect(i)}
                        disabled={revealed || !String(opt).trim()}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
                          !revealed && String(opt).trim() && "border-white/10 bg-white/[0.03] hover:border-violet-500/40 hover:bg-violet-500/10",
                          !String(opt).trim() && "cursor-not-allowed border-dashed border-white/[0.08] bg-white/[0.02] opacity-40",
                          revealed && isCorrect && "border-emerald-500/70 bg-emerald-500/15 text-emerald-100",
                          revealed && !isCorrect && isPicked && "border-red-500/80 bg-red-500/15 text-red-100",
                          revealed && !isCorrect && !isPicked && "border-white/[0.06] opacity-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                            !revealed && "bg-white/10 text-white/80",
                            revealed && isCorrect && "bg-emerald-500/30 text-emerald-100",
                            revealed && !isCorrect && isPicked && "bg-red-500/30 text-red-100",
                            revealed && !isCorrect && !isPicked && "bg-white/5 text-white/40"
                          )}
                        >
                          {optionLetters[i]}
                        </span>
                        <span className="pt-0.5 leading-relaxed text-white/90 [overflow-wrap:anywhere]">
                          {String(opt).trim() || "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {showExplain && fallbackExplain && (
                  <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5 text-center text-xs leading-relaxed text-white/65 [overflow-wrap:anywhere]">
                    {fallbackExplain}
                  </div>
                )}

                {quizSelected !== null && (
                  <div className="mt-auto pt-4">
                    <Button
                      type="button"
                      className="w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-md shadow-violet-500/20"
                      onClick={onQuizNext}
                    >
                      {quizIndex < total - 1 ? (
                        <>
                          Next question
                          <ChevronRight className="ml-1 inline h-4 w-4" />
                        </>
                      ) : (
                        "View results"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
