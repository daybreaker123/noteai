"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useNotesRemote } from "@/lib/use-notes-remote";
import { CreateCategoryModal } from "@/components/create-category-modal";
import { DeleteCategoryModal } from "@/components/delete-category-modal";
import { DeleteNoteModal } from "@/components/delete-note-modal";
import { Button, Card, Input, Textarea, Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { sanitizeGeneratedNoteTitle } from "@/lib/sanitize-note-title";
import { NOTE_IMPORT_FILE_ACCEPT, SLIDES_ANALYZE_FILE_ACCEPT } from "@/lib/note-import-utils";
import {
  ensureEditorHtml,
  htmlToPlainText,
  normalizeImprovedNoteHtml,
  noteContentPreview,
} from "@/lib/note-content-html";
import type { ConceptMapData } from "@/lib/concept-map-types";
import { conceptMapToNotePlainText } from "@/lib/concept-map-types";
import { ConceptMapModal } from "@/components/concept-map-modal";
import { studyGuideMarkdownToHtml } from "@/lib/study-guide-markdown";
import { TutorMarkdown } from "@/components/tutor-markdown";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { NoteRichTextEditor } from "@/components/note-rich-text-editor";
import { GuidedOnboarding } from "@/components/guided-onboarding";
import {
  getOnboardingDemoFlashcards,
  getOnboardingImprovedFallbackHtml,
  isOnboardingPersona,
  type OnboardingPersona,
} from "@/lib/onboarding-persona";
import { NoteTemplatePickerModal } from "@/components/note-template-picker-modal";
import { VoiceToNotesControl } from "@/components/voice-to-notes-control";
import { ShareResourceModal } from "@/components/share-resource-modal";
import { noteTemplateDefaultTitle, noteTemplateHtml, type NoteTemplateId } from "@/lib/note-templates";
import {
  fetchGoogleDocsClientConfig,
  pickGoogleDocWithAccessToken,
} from "@/lib/google-docs-import-client";
import type { Note, Category, StudySetSummary } from "@/lib/api-types";
import { buildStudySetTitleFromNoteTitles } from "@/lib/study-set-utils";
import { NoteStudyProgressBar, NoteStudyProgressTrail } from "@/components/note-study-progress";
import {
  computeStudyProgressCompletion,
  noteHasSavedStudySet,
  type StudyProgressCompletion,
  type StudyProgressStepId,
} from "@/lib/note-study-progress";
import type { FlashcardRating } from "@/lib/sm2-spaced-repetition";
import { parseStreakMilestoneFromJson, type StreakMilestone } from "@/lib/streak-client";
import {
  Plus,
  Search,
  FileText,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Cloud,
  X,
  Download,
  BookOpen,
  Loader2,
  Tag,
  GraduationCap,
  Trash2,
  HelpCircle,
  Bookmark,
  SquareStack,
  Save,
  Pin,
  Upload,
  FilePenLine,
  LayoutGrid,
  FolderPlus,
  Menu,
  Flame,
  Layers,
  Quote,
  Link2,
  Presentation,
  Network,
} from "lucide-react";

type StudaraUserStats = {
  current_streak: number;
  longest_streak: number;
  studied_today: boolean;
  total_notes: number;
  flashcard_sets_studied_this_week: number;
  quizzes_this_week: number;
  summarizations_this_month: number;
  recent_study_set_id: string | null;
  recent_study_set_title: string | null;
};

const PRO_FEATURE_DESCRIPTIONS: Record<string, string> = {
  study: "Study Mode turns your notes into flashcards and quizzes. Generate practice questions and test your knowledge with AI.",
  export: "Export your notes as PDF or Markdown for sharing, printing, or use in other apps.",
  autoCategorize: "Auto-categorization suggests the best category for your note using AI.",
  studyGuide:
    "AI Study Guide combines every note in a category into one exam-ready guide with summaries, key concepts, and a review checklist.",
  voiceTranscription:
    "Voice to Notes records or uploads lecture audio, transcribes it with AI, and turns it into structured study notes.",
  slidesAnalysis:
    "Analyze Slides turns PowerPoint or PDF lecture decks into detailed, structured study notes with Claude.",
  conceptMap:
    "Concept Map uses AI to pull out key ideas from your notes and shows how they connect in an interactive diagram you can rearrange, export, or save.",
};

/** Skip global ⌘N / ⌘K when typing in the editor or any form field. */
function shouldIgnoreAppShortcut(e: KeyboardEvent): boolean {
  const t = e.target;
  if (!t || !(t instanceof Element)) return false;
  return Boolean(
    t.closest("input, textarea, select, [contenteditable='true'], .studara-tiptap, .studara-tiptap-root")
  );
}

function userInitials(name: string | null | undefined, email: string | null | undefined) {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const e = email?.trim();
  if (e) return e.slice(0, 2).toUpperCase();
  return "?";
}

export function NoteApp({
  userId,
  initialOpenStudySetId = null,
  initialReviewDueSetId = null,
  studyReturnPath = null,
  minimalChromeUntilStudyOpen = false,
}: {
  userId: string;
  initialOpenStudySetId?: string | null;
  initialReviewDueSetId?: string | null;
  /** When set, closing a saved-set study modal navigates here (e.g. `/study-sets`). */
  studyReturnPath?: string | null;
  /** Hide notes sidebar/grid until the study modal opens (avoids flash when opening from Study Sets). */
  minimalChromeUntilStudyOpen?: boolean;
}) {
  const [streakMilestone, setStreakMilestone] = React.useState<StreakMilestone | null>(null);
  const [userStats, setUserStats] = React.useState<StudaraUserStats | null>(null);
  const flashcardEphemeralStreakRef = React.useRef(false);
  const [studyEmbedDismissed, setStudyEmbedDismissed] = React.useState(false);
  const [studyGuideModal, setStudyGuideModal] = React.useState<{
    categoryId: string;
    categoryName: string;
  } | null>(null);
  const [studyGuideLoading, setStudyGuideLoading] = React.useState(false);
  const [studyGuideText, setStudyGuideText] = React.useState<string | null>(null);
  const [studyGuideError, setStudyGuideError] = React.useState<string | null>(null);
  const [saveStudyGuideLoading, setSaveStudyGuideLoading] = React.useState(false);

  React.useEffect(() => {
    setStudyEmbedDismissed(false);
  }, [initialOpenStudySetId, initialReviewDueSetId]);

  const {
    categories,
    notes,
    loading,
    notesLoadError,
    plan,
    proHeavyUsage,
    refreshPlan,
    upgradeModal,
    setUpgradeModal,
    categoryError,
    clearCategoryError,
    saveErrorMessage,
    clearSaveErrorMessage,
    actions,
    FREE_NOTE_LIMIT,
  } = useNotesRemote(userId, { onStreakMilestone: (m) => setStreakMilestone(m) });

  const consumeStreakJson = React.useCallback((json: unknown) => {
    const m = parseStreakMilestoneFromJson(json);
    if (m) setStreakMilestone(m);
  }, []);

  const closeStudyGuideModal = React.useCallback(() => {
    setStudyGuideModal(null);
    setStudyGuideText(null);
    setStudyGuideError(null);
    setStudyGuideLoading(false);
    setSaveStudyGuideLoading(false);
  }, []);

  const requestStudyGuide = React.useCallback(
    (categoryId: string, categoryName: string) => {
      if (plan !== "pro") {
        setUpgradeModal({ show: true, feature: "studyGuide" });
        return;
      }
      setStudyGuideModal({ categoryId, categoryName });
      setStudyGuideText(null);
      setStudyGuideError(null);
      setStudyGuideLoading(true);
      void (async () => {
        try {
          const res = await fetch("/api/ai/anthropic/study-guide", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: categoryId }),
          });
          const json = (await res.json().catch(() => null)) as {
            study_guide?: string;
            error?: string;
            code?: string;
          };
          if (json?.code === "PRO_REQUIRED_STUDY_GUIDE" && res.status === 402) {
            setUpgradeModal({ show: true, feature: "studyGuide" });
            setStudyGuideModal(null);
            return;
          }
          if (!res.ok) {
            setStudyGuideError(json?.error ?? "Could not generate study guide");
            return;
          }
          if (json?.study_guide?.trim()) {
            setStudyGuideText(json.study_guide);
            consumeStreakJson(json);
          } else {
            setStudyGuideError("Empty response");
          }
        } catch {
          setStudyGuideError("Something went wrong. Try again.");
        } finally {
          setStudyGuideLoading(false);
        }
      })();
    },
    [plan, consumeStreakJson]
  );

  const saveStudyGuideToNote = React.useCallback(async () => {
    if (!studyGuideModal || !studyGuideText?.trim()) return;
    setSaveStudyGuideLoading(true);
    try {
      const title = `Study guide — ${studyGuideModal.categoryName}`;
      const html = ensureEditorHtml(studyGuideMarkdownToHtml(studyGuideText));
      const note = await actions.create(studyGuideModal.categoryId, title);
      if (note) {
        await actions.update(note.id, { content: html });
        setSelectedCategoryId(studyGuideModal.categoryId);
        setSelectedNoteId(note.id);
        closeStudyGuideModal();
        setMobileSidebarOpen(false);
      }
    } finally {
      setSaveStudyGuideLoading(false);
    }
  }, [studyGuideModal, studyGuideText, actions, closeStudyGuideModal]);

  const downloadStudyGuidePdf = React.useCallback(async () => {
    if (!studyGuideModal || !studyGuideText?.trim()) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Study guide — ${studyGuideModal.categoryName}`, 20, 20);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(studyGuideText, 170);
    let y = 32;
    const lineHeight = 5;
    const pageBreak = 285;
    for (const line of lines) {
      if (y > pageBreak) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 20, y);
      y += lineHeight;
    }
    const safe = studyGuideModal.categoryName.replace(/[^\w\-]+/g, "-").slice(0, 48);
    doc.save(`study-guide-${safe || "category"}.pdf`);
  }, [studyGuideModal, studyGuideText]);

  const loadUserStats = React.useCallback(async () => {
    try {
      const res = await fetch("/api/user-stats");
      if (!res.ok) return;
      const data = (await res.json()) as StudaraUserStats;
      setUserStats(data);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (userId && !loading) void loadUserStats();
  }, [userId, loading, loadUserStats]);

  const reportQuizSessionComplete = React.useCallback(
    async (savedSetId: string | null) => {
      try {
        const res = await fetch("/api/user-stats/quiz-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ study_set_id: savedSetId }),
        });
        const j = await res.json().catch(() => null);
        consumeStreakJson(j);
        void loadUserStats();
      } catch {
        /* ignore */
      }
    },
    [consumeStreakJson, loadUserStats]
  );

  const router = useRouter();
  const { data: session } = useSession();

  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | "all" | null>(null);
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  type StudyModalState =
    | { kind: "single"; noteId: string }
    | { kind: "multi"; noteIds: string[] }
    | { kind: "saved"; setId: string; title: string; reviewDueOnly?: boolean };
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
  const [flashcardOriginalIndices, setFlashcardOriginalIndices] = React.useState<number[]>([]);
  const [flashcardReviewDueTotal, setFlashcardReviewDueTotal] = React.useState<number | null>(null);
  const [flashcardSessionReviewed, setFlashcardSessionReviewed] = React.useState(0);
  const [flashcardsSessionComplete, setFlashcardsSessionComplete] = React.useState(false);
  const [flashcardRatingLoading, setFlashcardRatingLoading] = React.useState(false);
  const [exportMenu, setExportMenu] = React.useState<string | null>(null);
  const [studySetLoadError, setStudySetLoadError] = React.useState<string | null>(null);
  const [suggestBanner, setSuggestBanner] = React.useState<{ categoryId: string; name: string } | null>(null);
  const [newNoteIds, setNewNoteIds] = React.useState<Set<string>>(new Set());
  const [summaryCache, setSummaryCache] = React.useState<Record<string, string>>({});
  const [summaryLoading, setSummaryLoading] = React.useState<Set<string>>(new Set());
  const [draftNote, setDraftNote] = React.useState<Note | null>(null);
  const [summaryBelow, setSummaryBelow] = React.useState<string | null>(null);
  const [summarizeLoading, setSummarizeLoading] = React.useState(false);
  const [autoCategorizeLoading, setAutoCategorizeLoading] = React.useState(false);
  const [studyLoading, setStudyLoading] = React.useState<"flashcards" | "quiz" | null>(null);
  const [studySaveLoading, setStudySaveLoading] = React.useState<"flashcards" | "quiz" | null>(null);
  const [studyError, setStudyError] = React.useState<string | null>(null);
  const [improveLoading, setImproveLoading] = React.useState(false);
  const [conceptMapModalOpen, setConceptMapModalOpen] = React.useState(false);
  const [conceptMapGraph, setConceptMapGraph] = React.useState<ConceptMapData | null>(null);
  const [conceptMapLoading, setConceptMapLoading] = React.useState(false);
  const [conceptMapSaveNoteLoading, setConceptMapSaveNoteLoading] = React.useState(false);
  const [titleLoading, setTitleLoading] = React.useState(false);
  const [tagsLoading, setTagsLoading] = React.useState(false);
  const [suggestTagsChips, setSuggestTagsChips] = React.useState<string[] | null>(null);
  const [toolbarError, setToolbarError] = React.useState<string | null>(null);
  const [improveToast, setImproveToast] = React.useState(false);
  const [shareNoteModalNoteId, setShareNoteModalNoteId] = React.useState<string | null>(null);
  const [linkCopiedToast, setLinkCopiedToast] = React.useState(false);
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = React.useState(false);
  const [createCategoryLoading, setCreateCategoryLoading] = React.useState(false);
  const [newNoteTemplateModalOpen, setNewNoteTemplateModalOpen] = React.useState(false);
  const [deleteCategoryModal, setDeleteCategoryModal] = React.useState<{ id: string; name: string } | null>(null);
  const [deleteNoteModal, setDeleteNoteModal] = React.useState<{
    id: string;
    title?: string;
    fromEditor?: boolean;
  } | null>(null);
  const [deleteNoteLoading, setDeleteNoteLoading] = React.useState(false);
  const [importDocLoading, setImportDocLoading] = React.useState(false);
  /** Shown only after a Google Doc is chosen, while the server builds the note (not during OAuth/picker). */
  const [importGoogleDocSaving, setImportGoogleDocSaving] = React.useState(false);
  const [importDocError, setImportDocError] = React.useState<string | null>(null);
  const [slidesAnalyzeLoading, setSlidesAnalyzeLoading] = React.useState(false);
  const [slidesAnalyzeError, setSlidesAnalyzeError] = React.useState<string | null>(null);
  const [voiceNotesError, setVoiceNotesError] = React.useState<string | null>(null);
  const [importDropdownOpen, setImportDropdownOpen] = React.useState(false);
  const importDropdownRef = React.useRef<HTMLDivElement>(null);
  const [googleDocsImportEnabled, setGoogleDocsImportEnabled] = React.useState<boolean | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const importDocumentInputRef = React.useRef<HTMLInputElement>(null);
  const analyzeSlidesInputRef = React.useRef<HTMLInputElement>(null);
  const sidebarSearchInputRef = React.useRef<HTMLInputElement>(null);
  const processedOpenStudyRef = React.useRef<string | null>(null);
  const processedReviewDueRef = React.useRef<string | null>(null);
  const studyModalRef = React.useRef<StudyModalState | null>(null);
  const flashcardsLenRef = React.useRef(0);
  const cardIndexRef = React.useRef(0);
  const flashcardOriginalIndicesRef = React.useRef<number[]>([]);
  studyModalRef.current = studyModal;
  flashcardsLenRef.current = flashcards.length;
  cardIndexRef.current = cardIndex;
  flashcardOriginalIndicesRef.current = flashcardOriginalIndices;

  const primeFlashcardSession = React.useCallback(
    (
      cards: { front: string; back: string }[],
      opts?: { originalIndices?: number[]; reviewDueTotal?: number | null }
    ) => {
      setFlashcards(cards);
      setFlashcardOriginalIndices(opts?.originalIndices ?? cards.map((_, i) => i));
      setFlashcardReviewDueTotal(opts?.reviewDueTotal ?? null);
      setFlashcardSessionReviewed(0);
      setFlashcardsSessionComplete(false);
      setCardIndex(0);
      setCardFlipped(false);
    },
    []
  );

  React.useEffect(() => {
    if (!mobileSidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileSidebarOpen]);

  React.useEffect(() => {
    if (!linkCopiedToast) return;
    const t = window.setTimeout(() => setLinkCopiedToast(false), 2500);
    return () => window.clearTimeout(t);
  }, [linkCopiedToast]);

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
      list = list.filter((n) => {
        const body = htmlToPlainText(n.content).toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          body.includes(q) ||
          (n.tags ?? []).some((t) => t.toLowerCase().includes(q))
        );
      });
    }
    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const aTime = a.updated_at ?? a.created_at ?? "";
      const bTime = b.updated_at ?? b.created_at ?? "";
      return bTime.localeCompare(aTime);
    });
  }, [notes, selectedCategoryId, searchQuery]);

  const noteCounts = React.useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const n of notes) {
      const key = n.category_id ?? "__uncat__";
      byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
    }
    return { total: notes.length, byCategory };
  }, [notes]);

  const selectedNote =
    selectedNoteId && draftNote && selectedNoteId === draftNote.id
      ? draftNote
      : selectedNoteId
        ? notes.find((n) => n.id === selectedNoteId) ?? null
        : null;
  const [editTitle, setEditTitle] = React.useState("");
  const [editContent, setEditContent] = React.useState("");
  /** Bumps when AI replaces full body so Tiptap remounts with new HTML. */
  const [editorContentRevision, setEditorContentRevision] = React.useState(0);

  const requestConceptMap = React.useCallback(async () => {
    if (plan !== "pro") {
      setUpgradeModal({ show: true, feature: "conceptMap" });
      return;
    }
    const plain = htmlToPlainText(editContent).trim();
    if (!plain) {
      setToolbarError("Add some note content first.");
      return;
    }
    setToolbarError(null);
    setConceptMapLoading(true);
    try {
      const res = await fetch("/api/ai/anthropic/concept-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      const json = (await res.json().catch(() => null)) as {
        graph?: ConceptMapData;
        error?: string;
        code?: string;
      };
      if (json?.code === "PRO_FEATURE_CONCEPT_MAP" && res.status === 402) {
        setUpgradeModal({ show: true, feature: "conceptMap" });
        return;
      }
      if (!res.ok || !json?.graph) {
        setToolbarError(json?.error ?? "Could not generate concept map.");
        return;
      }
      consumeStreakJson(json);
      setConceptMapGraph(json.graph);
      setConceptMapModalOpen(true);
    } catch {
      setToolbarError("Something went wrong. Try again.");
    } finally {
      setConceptMapLoading(false);
    }
  }, [plan, editContent, consumeStreakJson, setUpgradeModal]);

  const saveConceptMapAsNote = React.useCallback(
    async (data: ConceptMapData) => {
      if (!selectedNote) return;
      setConceptMapSaveNoteLoading(true);
      setToolbarError(null);
      try {
        const sourceTitle = (editTitle || "Untitled").trim();
        const plain = conceptMapToNotePlainText(sourceTitle, data);
        const html = ensureEditorHtml(plain);
        const titleBase = sourceTitle.slice(0, 80);
        const title = `Concept map — ${titleBase || "Note"}`;
        const note = await actions.create(selectedNote.category_id ?? null, title);
        if (note) {
          await actions.update(note.id, { content: html });
          if (note.category_id) setSelectedCategoryId(note.category_id);
          setSelectedNoteId(note.id);
          setEditTitle(note.title);
          setEditContent(html);
          setEditorContentRevision((r) => r + 1);
          setConceptMapModalOpen(false);
          setConceptMapGraph(null);
        }
      } catch {
        setToolbarError("Could not save concept map as a note.");
      } finally {
        setConceptMapSaveNoteLoading(false);
      }
    },
    [selectedNote, editTitle, actions, setSelectedCategoryId, setSelectedNoteId]
  );
  const editTitleRef = React.useRef(editTitle);
  const editContentRef = React.useRef(editContent);
  const skipSyncRef = React.useRef(false);
  const lastLoadedEditorNoteIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    editTitleRef.current = editTitle;
    editContentRef.current = editContent;
  }, [editTitle, editContent]);

  React.useEffect(() => {
    setEditorContentRevision(0);
  }, [selectedNoteId]);

  React.useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    if (!selectedNoteId) {
      lastLoadedEditorNoteIdRef.current = null;
      return;
    }
    if (!selectedNote) return;
    const id = selectedNote.id;
    if (lastLoadedEditorNoteIdRef.current === id) {
      setEditTitle(selectedNote.title);
      return;
    }
    lastLoadedEditorNoteIdRef.current = id;
    setEditTitle(selectedNote.title);
    setEditContent(ensureEditorHtml(selectedNote.content));
  }, [selectedNoteId, selectedNote, draftNote]);

  const [onboardingGate, setOnboardingGate] = React.useState<"unknown" | "needs" | "done">("unknown");
  const [guidedOnboarding, setGuidedOnboarding] = React.useState<{
    step: number;
    persona: OnboardingPersona | null;
    sampleNoteId: string | null;
  } | null>(null);
  const guidedOnboardingRef = React.useRef(guidedOnboarding);
  React.useEffect(() => {
    guidedOnboardingRef.current = guidedOnboarding;
  }, [guidedOnboarding]);

  const [guidedWelcomeLoading, setGuidedWelcomeLoading] = React.useState(false);
  const [guidedFinishLoading, setGuidedFinishLoading] = React.useState(false);
  const guidedImproveInFlightRef = React.useRef(false);
  const guidedFlashcardsStartedRef = React.useRef(false);
  const guidedStep4ExitRef = React.useRef(false);
  const improveButtonRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!userId || loading) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/onboarding", { cache: "no-store", credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setOnboardingGate("done");
          return;
        }
        const j = (await res.json()) as {
          needsOnboarding?: boolean;
          resume?: { persona: string | null; sampleNoteId: string } | null;
        };
        if (cancelled) return;
        if (!j.needsOnboarding) {
          setOnboardingGate("done");
          setGuidedOnboarding(null);
          return;
        }
        setOnboardingGate("needs");
        const r = j.resume;
        if (r?.sampleNoteId && r.persona && isOnboardingPersona(r.persona)) {
          setGuidedOnboarding({
            step: 2,
            persona: r.persona,
            sampleNoteId: r.sampleNoteId,
          });
        } else {
          setGuidedOnboarding({ step: 1, persona: null, sampleNoteId: null });
        }
      } catch {
        if (!cancelled) setOnboardingGate("done");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loading]);

  React.useEffect(() => {
    if (onboardingGate !== "needs" || !guidedOnboarding?.sampleNoteId || guidedOnboarding.step !== 2) return;
    if (selectedNoteId !== guidedOnboarding.sampleNoteId) {
      setSelectedCategoryId("all");
      setDraftNote(null);
      setSelectedNoteId(guidedOnboarding.sampleNoteId);
    }
  }, [onboardingGate, guidedOnboarding, selectedNoteId]);

  const skipOrCompleteGuidedOnboarding = React.useCallback(async () => {
    try {
      await fetch("/api/me/onboarding/complete", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    setOnboardingGate("done");
    setGuidedOnboarding(null);
    guidedFlashcardsStartedRef.current = false;
    guidedStep4ExitRef.current = false;
    guidedImproveInFlightRef.current = false;
    setStudyModal(null);
    setStudyMode("menu");
    setFlashcards([]);
    setCardIndex(0);
    setCardFlipped(false);
    setStudyLoading(null);
    setStudyError(null);
    setMobileSidebarOpen(false);
    await actions.refresh();
    void loadUserStats();
  }, [actions, loadUserStats]);

  const finishGuidedOnboardingDashboard = React.useCallback(async () => {
    setGuidedFinishLoading(true);
    try {
      await fetch("/api/me/onboarding/complete", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    setOnboardingGate("done");
    setGuidedOnboarding(null);
    guidedFlashcardsStartedRef.current = false;
    guidedStep4ExitRef.current = false;
    guidedImproveInFlightRef.current = false;
    setMobileSidebarOpen(false);
    lastLoadedEditorNoteIdRef.current = null;
    await actions.refresh();
    void loadUserStats();
    setGuidedFinishLoading(false);
  }, [actions, loadUserStats]);

  const handleGuidedWelcomeContinue = React.useCallback(async () => {
    const persona = guidedOnboarding?.persona;
    if (!persona) return;
    setGuidedWelcomeLoading(true);
    try {
      const res = await fetch("/api/me/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ persona }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        skipped?: boolean;
        reason?: string;
        noteId?: string;
        persona?: OnboardingPersona;
      };
      if (j.skipped && j.reason === "note_limit") {
        await skipOrCompleteGuidedOnboarding();
        return;
      }
      if (!j.noteId) {
        setToolbarError("Could not create your sample note. Try again or skip.");
        return;
      }
      await actions.refresh();
      lastLoadedEditorNoteIdRef.current = null;
      setGuidedOnboarding({
        step: 2,
        persona: j.persona ?? persona,
        sampleNoteId: j.noteId,
      });
      setSelectedCategoryId("all");
      setDraftNote(null);
      setSelectedNoteId(j.noteId);
    } catch {
      setToolbarError("Something went wrong starting onboarding.");
    } finally {
      setGuidedWelcomeLoading(false);
    }
  }, [guidedOnboarding?.persona, actions, skipOrCompleteGuidedOnboarding]);

  const runGuidedAutoImprove = React.useCallback(async () => {
    if (guidedImproveInFlightRef.current) return;
    const g = guidedOnboardingRef.current;
    if (!g || g.step !== 2 || !g.sampleNoteId || !g.persona) return;
    guidedImproveInFlightRef.current = true;
    setToolbarError(null);
    setImproveLoading(true);
    try {
      const res = await fetch("/api/ai/anthropic/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editContentRef.current,
          onboardingSampleNoteId: g.sampleNoteId,
        }),
      });
      const json = (await res.json()) as { improved?: string; error?: string; code?: string };
      let improvedHtml: string | null = null;
      if (json.improved) {
        consumeStreakJson(json);
        improvedHtml = normalizeImprovedNoteHtml(json.improved);
      } else {
        improvedHtml = getOnboardingImprovedFallbackHtml(g.persona);
      }
      if (improvedHtml) {
        setEditContent(improvedHtml);
        setEditorContentRevision((r) => r + 1);
        void actions.update(g.sampleNoteId, { content: improvedHtml, record_improvement: true });
        setImproveToast(true);
        setTimeout(() => setImproveToast(false), 3000);
      }
      setGuidedOnboarding((prev) => (prev && prev.step === 2 ? { ...prev, step: 3 } : prev));
    } catch {
      const g2 = guidedOnboardingRef.current;
      if (g2?.persona && g2.sampleNoteId) {
        const fb = getOnboardingImprovedFallbackHtml(g2.persona);
        setEditContent(fb);
        setEditorContentRevision((r) => r + 1);
        void actions.update(g2.sampleNoteId, { content: fb });
        setGuidedOnboarding((prev) => (prev && prev.step === 2 ? { ...prev, step: 3 } : prev));
      }
    } finally {
      setImproveLoading(false);
      guidedImproveInFlightRef.current = false;
    }
  }, [actions, consumeStreakJson]);

  React.useEffect(() => {
    if (!guidedOnboarding || guidedOnboarding.step !== 2) return;
    const t = window.setTimeout(() => {
      if (guidedOnboardingRef.current?.step !== 2) return;
      void runGuidedAutoImprove();
    }, 10_000);
    return () => clearTimeout(t);
  }, [guidedOnboarding?.step, guidedOnboarding?.sampleNoteId, runGuidedAutoImprove]);

  React.useEffect(() => {
    if (guidedOnboarding?.step !== 3) return;
    const t = window.setTimeout(() => {
      setGuidedOnboarding((prev) => (prev?.step === 3 ? { ...prev, step: 4 } : prev));
    }, 4500);
    return () => clearTimeout(t);
  }, [guidedOnboarding?.step]);

  React.useEffect(() => {
    if (!guidedOnboarding) {
      guidedFlashcardsStartedRef.current = false;
      guidedStep4ExitRef.current = false;
    }
  }, [guidedOnboarding]);

  React.useEffect(() => {
    if (guidedOnboarding?.step !== 4 || !guidedOnboarding.sampleNoteId) return;
    if (guidedFlashcardsStartedRef.current) return;
    guidedFlashcardsStartedRef.current = true;
    guidedStep4ExitRef.current = false;
    const nid = guidedOnboarding.sampleNoteId;
    const persona = guidedOnboarding.persona;
    void (async () => {
      setStudyModal({ kind: "single", noteId: nid });
      setStudyMode("menu");
      setStudyError(null);
      setStudyLoading("flashcards");
      try {
        const res = await fetch(`/api/study/${nid}`);
        const json = (await res.json()) as {
          flashcards?: { cards?: { front: string; back: string }[] } | null;
          code?: string;
        };
        let cards: { front: string; back: string }[] | null = null;
        const payload = json?.flashcards;
        if (payload && typeof payload === "object" && "cards" in payload) {
          cards = payload.cards ?? null;
        }
        if (!cards?.length) {
          const post = await fetch(`/api/study/${nid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "flashcards" }),
          });
          const j = (await post.json()) as { cards?: { front: string; back: string }[] };
          consumeStreakJson(j);
          cards = j.cards ?? null;
        }
        if (!cards?.length && persona) {
          cards = getOnboardingDemoFlashcards(persona);
        }
        primeFlashcardSession(cards ?? []);
        setStudyMode("flashcards");
        void refreshStudySets();
      } catch {
        const p = guidedOnboardingRef.current?.persona;
        if (p) primeFlashcardSession(getOnboardingDemoFlashcards(p));
        setStudyMode("flashcards");
      } finally {
        setStudyLoading(null);
      }
    })();
  }, [guidedOnboarding?.step, guidedOnboarding?.sampleNoteId, guidedOnboarding?.persona, primeFlashcardSession, refreshStudySets, consumeStreakJson]);

  React.useEffect(() => {
    if (guidedOnboarding?.step !== 4) return;
    const t = window.setTimeout(() => {
      if (guidedOnboardingRef.current?.step !== 4 || guidedStep4ExitRef.current) return;
      guidedStep4ExitRef.current = true;
      setStudyModal(null);
      setStudyMode("menu");
      setFlashcards([]);
      setFlashcardOriginalIndices([]);
      setFlashcardReviewDueTotal(null);
      setCardIndex(0);
      setCardFlipped(false);
      setStudyLoading(null);
      setStudyError(null);
      setGuidedOnboarding((prev) => (prev?.step === 4 ? { ...prev, step: 5 } : prev));
    }, 14_000);
    return () => clearTimeout(t);
  }, [guidedOnboarding?.step]);

  React.useEffect(() => {
    if (guidedOnboarding?.step !== 4 || studyMode !== "flashcards") return;
    if (!cardFlipped) return;
    const t = window.setTimeout(() => {
      if (guidedOnboardingRef.current?.step !== 4 || guidedStep4ExitRef.current) return;
      guidedStep4ExitRef.current = true;
      setStudyModal(null);
      setStudyMode("menu");
      setFlashcards([]);
      setFlashcardOriginalIndices([]);
      setFlashcardReviewDueTotal(null);
      setCardIndex(0);
      setCardFlipped(false);
      setStudyLoading(null);
      setStudyError(null);
      setGuidedOnboarding((prev) => (prev?.step === 4 ? { ...prev, step: 5 } : prev));
    }, 1400);
    return () => clearTimeout(t);
  }, [guidedOnboarding?.step, studyMode, cardFlipped]);

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
          kind: "flashcards", // persisted to study_sets.kind
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
          kind: "quiz", // persisted to study_sets.kind
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

  /** Latest editor snapshot for flushing when leaving a note (avoids losing debounced edits). */
  const editorFlushRef = React.useRef<{ id: string | null; title: string; content: string }>({
    id: null,
    title: "",
    content: "",
  });
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  React.useLayoutEffect(() => {
    return () => {
      const snap = editorFlushRef.current;
      if (!snap.id || snap.id.startsWith("draft-")) return;
      const n = notes.find((x) => x.id === snap.id);
      if (!n) return;
      if (n.title === snap.title && n.content === snap.content) return;
      void actionsRef.current.update(snap.id, { title: snap.title, content: snap.content });
    };
  }, [selectedNoteId, draftNote, notes]);

  React.useLayoutEffect(() => {
    if (selectedNoteId && !draftNote && selectedNote && !selectedNoteId.startsWith("draft-")) {
      editorFlushRef.current = {
        id: selectedNoteId,
        title: editTitle,
        content: editContent,
      };
    } else {
      editorFlushRef.current = { id: null, title: "", content: "" };
    }
  }, [selectedNoteId, editTitle, editContent, draftNote, selectedNote]);

  const saveDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!selectedNoteId || !selectedNote || draftNote) return;
    saveDebounce.current = setTimeout(() => {
      actions.update(selectedNoteId, { title: editTitle, content: editContent });
      if (newNoteIds.has(selectedNoteId) && htmlToPlainText(editContent).trim().length > 50 && plan === "pro") {
        const catIds = categories.map((c) => c.id);
        const catNames = categories.map((c) => c.name);
        fetch("/api/ai/anthropic/suggest-category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: htmlToPlainText(editContent),
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
    if (!exportMenu) return;
    function onPointerDown(e: PointerEvent) {
      const root = document.querySelector(`[data-note-export-root="${exportMenu}"]`);
      const t = e.target;
      if (root && t instanceof Node && root.contains(t)) return;
      setExportMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [exportMenu]);

  const openNewNotePicker = React.useCallback(() => {
    if (onboardingGate === "needs" && guidedOnboarding && guidedOnboarding.step >= 2 && guidedOnboarding.step <= 4) {
      return;
    }
    if (plan !== "pro" && notes.length >= FREE_NOTE_LIMIT) {
      setUpgradeModal({ show: true, message: "You've reached the free limit — upgrade to Pro for unlimited notes" });
      return;
    }
    setNewNoteTemplateModalOpen(true);
  }, [plan, notes.length, FREE_NOTE_LIMIT, setUpgradeModal, onboardingGate, guidedOnboarding]);

  const createNewNoteWithInitial = React.useCallback(
    ({ title, content }: { title: string; content: string }) => {
      setNewNoteTemplateModalOpen(false);
      if (plan !== "pro" && notes.length >= FREE_NOTE_LIMIT) {
        setUpgradeModal({ show: true, message: "You've reached the free limit — upgrade to Pro for unlimited notes" });
        return;
      }
      const sid = selectedCategoryIdRef.current;
      /** Sidebar category filter: specific id, or "all" / null → uncategorized */
      const targetCategoryId: string | null = sid && sid !== "all" ? sid : null;
      const bodyHtml = ensureEditorHtml(content);

      const draftId = `draft-${Date.now()}`;
      const draft: Note = {
        id: draftId,
        user_id: userId,
        category_id: targetCategoryId,
        title,
        content: bodyHtml,
        pinned: false,
        tags: [],
      };
      setDraftNote(draft);
      setSelectedNoteId(draftId);
      setEditTitle(title);
      setEditContent(bodyHtml);
      setNewNoteIds((prev) => new Set(prev).add(draftId));
      setMobileSidebarOpen(false);

      (async () => {
        const note = await actions.create(targetCategoryId, title);
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
    },
    [userId, actions, plan, notes.length, FREE_NOTE_LIMIT, setUpgradeModal]
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (shouldIgnoreAppShortcut(e)) return;
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openNewNotePicker();
      }
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        sidebarSearchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNewNotePicker]);

  async function handleImportDocumentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (plan !== "pro" && notes.length >= FREE_NOTE_LIMIT) {
      setUpgradeModal({
        show: true,
        message: "You've reached the free limit — upgrade to Pro for unlimited notes",
      });
      return;
    }
    setImportDocError(null);
    setImportDocLoading(true);
    const sid = selectedCategoryIdRef.current;
    const targetCategoryId: string | null = sid && sid !== "all" ? sid : null;
    const result = await actions.importDocumentFromFile(file, targetCategoryId);
    setImportDocLoading(false);
    if (result.ok === false) {
      setImportDocError(result.error);
      return;
    }
    const { note, truncated } = result;
    setSelectedNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(ensureEditorHtml(note.content));
    setDraftNote(null);
    setSelectedCategoryId(note.category_id ?? "all");
    setStudyModal(null);
    exitGridSelection();
    if (truncated) {
      setToolbarError(
        "This document was very long — only the first portion was imported. You can add the rest manually if needed."
      );
    }
  }

  async function handleAnalyzeSlidesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (plan !== "pro") {
      setUpgradeModal({ show: true, feature: "slidesAnalysis" });
      return;
    }
    setSlidesAnalyzeError(null);
    setSlidesAnalyzeLoading(true);
    try {
      const sid = selectedCategoryIdRef.current;
      const category_id = sid && sid !== "all" ? sid : null;
      const fd = new FormData();
      fd.append("file", file);
      if (category_id) fd.append("category_id", category_id);
      const res = await fetch("/api/notes/analyze-slides", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = (await res.json()) as {
        id?: string;
        title?: string;
        content?: string;
        category_id?: string | null;
        error?: string;
        code?: string;
      };
      if (json.code === "PRO_FEATURE_SLIDES_ANALYSIS" && res.status === 402) {
        setUpgradeModal({ show: true, feature: "slidesAnalysis" });
        return;
      }
      if (!res.ok || !json.id) {
        setSlidesAnalyzeError(json.error ?? "Couldn’t analyze those slides.");
        return;
      }
      consumeStreakJson(json);
      await actions.refresh();
      lastLoadedEditorNoteIdRef.current = null;
      setSelectedNoteId(json.id);
      setEditTitle(json.title ?? "Untitled");
      setEditContent(ensureEditorHtml(json.content ?? ""));
      setDraftNote(null);
      setSelectedCategoryId(json.category_id ?? "all");
      setStudyModal(null);
      exitGridSelection();
      setNewNoteIds((prev) => new Set(prev).add(json.id));
      setMobileSidebarOpen(false);
    } catch {
      setSlidesAnalyzeError("Something went wrong. Please try again.");
    } finally {
      setSlidesAnalyzeLoading(false);
    }
  }

  async function handleImportFromGoogleDocs() {
    setImportDropdownOpen(false);
    setImportDocError(null);
    if (plan !== "pro" && notes.length >= FREE_NOTE_LIMIT) {
      setUpgradeModal({
        show: true,
        message: "You've reached the free limit — upgrade to Pro for unlimited notes",
      });
      return;
    }
    const cfg = await fetchGoogleDocsClientConfig();
    setGoogleDocsImportEnabled(cfg.enabled);
    if (!cfg.enabled) {
      setImportDocError(
        "Google Docs import isn’t set up yet. Add GOOGLE_PICKER_API_KEY (browser key) and GOOGLE_CLIENT_ID to your environment, and enable the Picker & Docs APIs in Google Cloud."
      );
      return;
    }
    let picked: Awaited<ReturnType<typeof pickGoogleDocWithAccessToken>>;
    try {
      picked = await pickGoogleDocWithAccessToken(cfg.clientId, cfg.apiKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not connect to Google";
      setImportDocError(msg);
      return;
    }
    if ("cancelled" in picked) return;

    setImportGoogleDocSaving(true);
    try {
      const sid = selectedCategoryIdRef.current;
      const category_id = sid && sid !== "all" ? sid : null;
      const res = await fetch("/api/notes/import-google-doc", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${picked.accessToken}`,
        },
        body: JSON.stringify({ documentId: picked.documentId, category_id }),
      });
      const json = (await res.json()) as {
        id?: string;
        title?: string;
        content?: string;
        category_id?: string | null;
        error?: string;
        code?: string;
      };
      if (json.code === "FREE_LIMIT_NOTES" && res.status === 402) {
        setUpgradeModal({
          show: true,
          message: json.error ?? "You've reached the free limit — upgrade to Pro for unlimited notes",
        });
        return;
      }
      if (!res.ok || !json.id) {
        setImportDocError(json.error ?? "Couldn’t import that document.");
        return;
      }
      consumeStreakJson(json);
      await actions.refresh();
      lastLoadedEditorNoteIdRef.current = null;
      setSelectedNoteId(json.id);
      setEditTitle(json.title ?? "Untitled");
      setEditContent(ensureEditorHtml(json.content ?? ""));
      setDraftNote(null);
      setSelectedCategoryId(json.category_id ?? "all");
      setStudyModal(null);
      exitGridSelection();
      setNewNoteIds((prev) => new Set(prev).add(json.id));
      setMobileSidebarOpen(false);
    } catch {
      setImportDocError("Something went wrong while importing. Try again.");
    } finally {
      setImportGoogleDocSaving(false);
    }
  }

  const handleVoiceTranscriptionSuccess = React.useCallback(
    async (json: {
      id: string;
      title: string;
      content: string;
      category_id: string | null;
    } & Record<string, unknown>) => {
      console.log("[note-app] voice transcription success payload", {
        id: json.id,
        title: json.title,
        category_id: json.category_id,
        contentLength: typeof json.content === "string" ? json.content.length : 0,
      });
      consumeStreakJson(json);
      lastLoadedEditorNoteIdRef.current = null;
      setSelectedNoteId(json.id);
      setEditTitle(json.title ?? "Untitled");
      setEditContent(ensureEditorHtml(json.content ?? ""));
      setDraftNote(null);
      setSelectedCategoryId(json.category_id ?? "all");
      setStudyModal(null);
      setGridSelectMode(false);
      setGridSelectedIds(new Set());
      setMultiStudyError(null);
      setNewNoteIds((prev) => new Set(prev).add(json.id));
      setMobileSidebarOpen(false);
      setVoiceNotesError(null);
      setToolbarError(null);
      try {
        await actions.refresh();
      } catch (e) {
        console.error("[note-app] refresh after voice note failed (editor already updated)", e);
      }
      void loadUserStats();
    },
    [actions, consumeStreakJson, loadUserStats]
  );

  React.useEffect(() => {
    if (!importDropdownOpen) return;
    function onPointerDown(e: PointerEvent) {
      const root = importDropdownRef.current;
      const t = e.target;
      if (root && t instanceof Node && root.contains(t)) return;
      setImportDropdownOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [importDropdownOpen]);

  /** Sidebar category pick: leave note editor and show the grid for that category. */
  function selectSidebarCategory(categoryId: string | "all") {
    setMobileSidebarOpen(false);
    setSelectedCategoryId(categoryId);
    setSelectedNoteId(null);
    setDraftNote(null);
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

  /** Opens the same Study Mode menu as single-note study; user picks Flashcards or Quiz there. */
  function openMultiStudyMenu() {
    if (plan !== "pro") {
      setUpgradeModal({ show: true, feature: "study" });
      return;
    }
    const ids = [...gridSelectedIds].filter((id) => !id.startsWith("draft-"));
    if (ids.length === 0) {
      setMultiStudyError("Select at least one note.");
      return;
    }
    setMultiStudyError(null);
    setStudyError(null);
    setStudyModal({ kind: "multi", noteIds: ids });
    setStudyMode("menu");
    exitGridSelection();
  }

  /** Generate multi-note flashcards/quiz — used from StudyModal (same entry as single-note flow). */
  async function runMultiStudyGeneration(kind: "flashcards" | "quiz", noteIds: string[]) {
    const ids = noteIds.filter((id) => !id.startsWith("draft-"));
    if (ids.length === 0) {
      setStudyError("No valid notes selected.");
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
        questions?: { question: string; options: string[]; correctIndex: number; explanation?: string }[];
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
        setStudyError(json.error ?? "Generation failed");
        return;
      }
      consumeStreakJson(json);
      if (kind === "flashcards") {
        primeFlashcardSession(json.cards ?? []);
        setStudyMode("flashcards");
      } else {
        setQuizQuestions(json.questions ?? []);
        setStudyMode("quiz");
        setQuizIndex(0);
        setQuizScore(null);
        setQuizSelected(null);
      }
      void refreshStudySets();
    } catch {
      setStudyError(kind === "flashcards" ? "Failed to generate flashcards" : "Failed to generate quiz");
    } finally {
      setStudyLoading(null);
    }
  }

  async function loadAndOpenStudySet(setId: string, titleFallback?: string) {
    setStudyError(null);
    setStudySetLoadError(null);
    setStudyLoading("flashcards");
    try {
      const res = await fetch(`/api/study-sets/${setId}`);
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        kind?: "flashcards" | "quiz";
        title?: string;
        payload?: { cards?: { front: string; back: string }[]; questions?: { question: string; options: string[]; correctIndex: number }[] };
      } | null;
      if (!res.ok) {
        const msg = data && typeof data.error === "string" ? data.error : "Could not open study set";
        setStudySetLoadError(msg);
        return;
      }
      if (!data || (data.kind !== "flashcards" && data.kind !== "quiz")) {
        setStudySetLoadError("Invalid study set data");
        return;
      }
      if (data.kind === "flashcards") {
        primeFlashcardSession(data.payload?.cards ?? []);
        setStudyMode("flashcards");
      } else {
        setQuizQuestions(data.payload?.questions ?? []);
        setStudyMode("quiz");
        setQuizIndex(0);
        setQuizScore(null);
        setQuizSelected(null);
      }
      setStudyModal({ kind: "saved", setId, title: data.title ?? titleFallback ?? "Study set" });
    } catch {
      setStudySetLoadError("Could not open study set");
    } finally {
      setStudyLoading(null);
    }
  }

  const loadDueReviewSet = React.useCallback(
    async (setId: string) => {
      setStudyError(null);
      setStudySetLoadError(null);
      setStudyLoading("flashcards");
      try {
        const res = await fetch(`/api/study-sets/${setId}/due`);
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          title?: string;
          cards?: { front: string; back: string }[];
          original_indices?: number[];
          due_total?: number;
        } | null;
        if (!res.ok) {
          const msg = data && typeof data.error === "string" ? data.error : "Could not load due cards";
          setStudySetLoadError(msg);
          return;
        }
        const cards = data?.cards ?? [];
        const orig = data?.original_indices ?? [];
        if (cards.length === 0) {
          setStudySetLoadError("No flashcards due for review today.");
          return;
        }
        if (orig.length !== cards.length) {
          setStudySetLoadError("Invalid due cards response");
          return;
        }
        primeFlashcardSession(cards, { originalIndices: orig, reviewDueTotal: data?.due_total ?? cards.length });
        setStudyMode("flashcards");
        setStudyModal({ kind: "saved", setId, title: data?.title ?? "Study set", reviewDueOnly: true });
      } catch {
        setStudySetLoadError("Could not load due cards");
      } finally {
        setStudyLoading(null);
      }
    },
    [primeFlashcardSession]
  );

  const handleFlashcardRate = React.useCallback(async (rating: FlashcardRating) => {
    if (flashcardsSessionComplete || flashcardRatingLoading) return;
    const m = studyModalRef.current;
    const ci = cardIndexRef.current;
    const indices = flashcardOriginalIndicesRef.current;
    const originalIndex = indices[ci] ?? ci;
    const len = flashcardsLenRef.current;

    if (m?.kind === "saved") {
      setFlashcardRatingLoading(true);
      try {
        const res = await fetch("/api/flashcard-progress/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            study_set_id: m.setId,
            card_index: originalIndex,
            rating,
          }),
        });
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setStudyError(j?.error ?? "Could not save flashcard progress");
        } else {
          consumeStreakJson(j);
          void loadUserStats();
        }
      } catch {
        setStudyError("Could not save flashcard progress");
      } finally {
        setFlashcardRatingLoading(false);
      }
    } else if (m && !flashcardEphemeralStreakRef.current) {
      flashcardEphemeralStreakRef.current = true;
      try {
        const res = await fetch("/api/user-stats/record-activity", { method: "POST" });
        const j = await res.json().catch(() => null);
        consumeStreakJson(j);
        void loadUserStats();
      } catch {
        /* ignore */
      }
    }

    setFlashcardSessionReviewed((r) => r + 1);
    if (ci >= len - 1) {
      setFlashcardsSessionComplete(true);
    } else {
      setCardIndex(ci + 1);
      setCardFlipped(false);
    }
  }, [flashcardsSessionComplete, flashcardRatingLoading, consumeStreakJson, loadUserStats]);

  React.useEffect(() => {
    if (!initialOpenStudySetId || loading) return;
    if (onboardingGate !== "done") return;
    if (processedOpenStudyRef.current === initialOpenStudySetId) return;
    processedOpenStudyRef.current = initialOpenStudySetId;
    void loadAndOpenStudySet(initialOpenStudySetId).finally(() => {
      if (!studyReturnPath) {
        router.replace("/notes", { scroll: false });
      }
    });
  }, [initialOpenStudySetId, loading, onboardingGate, router, studyReturnPath]);

  React.useEffect(() => {
    if (!initialOpenStudySetId) processedOpenStudyRef.current = null;
  }, [initialOpenStudySetId]);

  React.useEffect(() => {
    if (!initialReviewDueSetId || loading) return;
    if (onboardingGate !== "done") return;
    if (processedReviewDueRef.current === initialReviewDueSetId) return;
    processedReviewDueRef.current = initialReviewDueSetId;
    void loadDueReviewSet(initialReviewDueSetId).finally(() => {
      if (!studyReturnPath) {
        router.replace("/notes", { scroll: false });
      }
    });
  }, [initialReviewDueSetId, loading, onboardingGate, router, loadDueReviewSet, studyReturnPath]);

  React.useEffect(() => {
    if (!initialReviewDueSetId) processedReviewDueRef.current = null;
  }, [initialReviewDueSetId]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  const holdStudyEmbedUI =
    minimalChromeUntilStudyOpen &&
    (initialOpenStudySetId || initialReviewDueSetId) &&
    !studyModal &&
    !studySetLoadError &&
    onboardingGate !== "needs" &&
    !studyEmbedDismissed;

  if (holdStudyEmbedUI) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  if (
    minimalChromeUntilStudyOpen &&
    studyReturnPath &&
    studySetLoadError &&
    !studyModal &&
    !studyEmbedDismissed
  ) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[var(--bg)] px-6 text-center">
        <p className="max-w-sm text-sm text-red-100/95">{studySetLoadError}</p>
        <Button
          type="button"
          className="border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)]"
          onClick={() => {
            setStudySetLoadError(null);
            setStudyEmbedDismissed(true);
            router.push(studyReturnPath);
          }}
        >
          Back to Study Sets
        </Button>
      </div>
    );
  }

  const studyLeaveButtonLabel =
    studyReturnPath === "/study-sets" ? "Back to study sets" : "Back to notes";

  const importDocumentMenu = (layout: "toolbar" | "hero") => {
    const isHero = layout === "hero";
    return (
      <div ref={importDropdownRef} className={cn("relative", isHero && "w-full max-w-xs")}>
        <Button
          type="button"
          size={isHero ? "md" : "sm"}
          variant="ghost"
          disabled={importDocLoading || importGoogleDocSaving || slidesAnalyzeLoading}
          className={cn(
            "gap-1.5 border border-[var(--border)] bg-[var(--btn-default-bg)] text-[var(--text)] hover:bg-[var(--btn-default-hover)]",
            isHero && "min-h-11 w-full justify-center"
          )}
          aria-expanded={importDropdownOpen}
          aria-haspopup="menu"
          onClick={() => {
            setImportDropdownOpen((o) => !o);
            if (googleDocsImportEnabled === null) {
              void fetchGoogleDocsClientConfig().then((c) => setGoogleDocsImportEnabled(c.enabled));
            }
          }}
        >
          <Upload className={isHero ? "h-4 w-4" : "h-3.5 w-3.5"} />
          Import
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </Button>
        {importDropdownOpen && (
          <div
            role="menu"
            className={cn(
              "absolute z-[80] min-w-[15rem] rounded-xl border border-[var(--border)] bg-[var(--surface-mid)] py-1 shadow-xl shadow-black/50",
              isHero ? "left-0 right-0 mt-2" : "right-0 top-[calc(100%+6px)]"
            )}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
              onClick={() => {
                setImportDropdownOpen(false);
                setImportDocError(null);
                importDocumentInputRef.current?.click();
              }}
            >
              <Upload className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              PDF or Word from device
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
              onClick={() => {
                setImportDropdownOpen(false);
                setSlidesAnalyzeError(null);
                if (plan !== "pro") {
                  setUpgradeModal({ show: true, feature: "slidesAnalysis" });
                  return;
                }
                analyzeSlidesInputRef.current?.click();
              }}
            >
              <Presentation className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              Analyze Slides
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={googleDocsImportEnabled === false}
              title={
                googleDocsImportEnabled === false
                  ? "Add GOOGLE_PICKER_API_KEY and GOOGLE_CLIENT_ID to enable Google Docs import"
                  : undefined
              }
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void handleImportFromGoogleDocs()}
            >
              <Cloud className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              Import from Google Docs
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex h-dvh max-w-[100vw] overflow-x-hidden bg-[var(--bg)]">
      {(importDocLoading || importGoogleDocSaving || slidesAnalyzeLoading) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--overlay-scrim)] p-6 backdrop-blur-sm"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-label={
            slidesAnalyzeLoading
              ? "Analyzing slides"
              : importGoogleDocSaving
                ? "Importing from Google Docs"
                : "Importing document"
          }
        >
          <div className="max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--modal-surface)] px-8 py-6 text-center shadow-xl shadow-purple-950/40">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-purple-400" aria-hidden />
            <p className="mt-4 text-sm font-medium text-[var(--text)]">
              {slidesAnalyzeLoading
                ? "Analyzing your slides…"
                : importGoogleDocSaving
                  ? "Importing from Google Docs…"
                  : "Importing document…"}
            </p>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              {slidesAnalyzeLoading
                ? "Extracting slide text and generating study notes with AI. This can take a minute for large decks."
                : importGoogleDocSaving
                  ? "Converting your Google Doc into a note — almost there."
                  : "Extracting text — large PDFs may take a little longer."}
            </p>
          </div>
        </div>
      )}
      {/* Background gradient (landing-style) */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/15 via-blue-500/10 to-fuchsia-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/5 via-purple-600/10 to-emerald-500/5 blur-3xl" />
      </div>

      {/* Mobile sidebar overlay */}
      <div
        role="presentation"
        aria-hidden={!mobileSidebarOpen}
        className={cn(
          "fixed inset-0 z-[35] bg-[var(--overlay-scrim)] backdrop-blur-sm transition-opacity duration-300 md:hidden",
          mobileSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-dvh shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] backdrop-blur-xl",
          "w-[min(18rem,92vw)] sm:w-72",
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:relative md:z-20 md:translate-x-0",
          mobileSidebarOpen ? "translate-x-0 shadow-2xl shadow-black/50" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="shrink-0 px-4 pt-5">
          <StudaraWordmarkLink
            href="/notes"
            linkClassName="touch-manipulation"
            onClick={() => setMobileSidebarOpen(false)}
          />
        </div>
        <div className="shrink-0 px-4 pb-4 pt-4">
          <button
            type="button"
            onClick={openNewNotePicker}
            className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/85 to-blue-500/85 px-4 py-3 text-sm font-semibold text-[var(--inverse-text)] shadow-lg shadow-purple-900/25 transition duration-200 hover:from-purple-500 hover:to-blue-500"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New Note
          </button>
        </div>
        <div className="shrink-0 px-4 pb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
            <input
              ref={sidebarSearchInputRef}
              data-search-input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes…"
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--text)] shadow-inner outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-purple-500/35 focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
        </div>
        <nav className="app-sidebar-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-6">
          {importDocError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
              <span>{importDocError}</span>
              <button
                type="button"
                onClick={() => setImportDocError(null)}
                className="shrink-0 text-red-300 transition hover:text-[var(--text)]"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {slidesAnalyzeError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
              <span>{slidesAnalyzeError}</span>
              <button
                type="button"
                onClick={() => setSlidesAnalyzeError(null)}
                className="shrink-0 text-red-300 transition hover:text-[var(--text)]"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {voiceNotesError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
              <span>{voiceNotesError}</span>
              <button
                type="button"
                onClick={() => setVoiceNotesError(null)}
                className="shrink-0 text-red-300 transition hover:text-[var(--text)]"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {categoryError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
              <span>{categoryError}</span>
              <button
                type="button"
                onClick={clearCategoryError}
                className="shrink-0 text-red-300 transition hover:text-[var(--text)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="px-1">
            <p className="mb-2.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">Notes</p>
            <div className="space-y-1">
              <CategoryTab
                id="all"
                name="All Notes"
                count={noteCounts.total}
                icon={<LayoutGrid className="h-4 w-4 shrink-0 text-[var(--muted)]" />}
                selected={selectedCategoryId === "all"}
                onClick={() => selectSidebarCategory("all")}
              />
              {categories.map((c) => (
                <CategoryTab
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  color={c.color}
                  count={noteCounts.byCategory.get(c.id) ?? 0}
                  selected={selectedCategoryId === c.id}
                  onClick={() => selectSidebarCategory(c.id)}
                  onStudyGuide={() => requestStudyGuide(c.id, c.name)}
                  onRename={() => {
                    const name = prompt("Rename category:", c.name);
                    if (name?.trim()) actions.updateCategory(c.id, name.trim());
                  }}
                  onDelete={() => setDeleteCategoryModal({ id: c.id, name: c.name })}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  clearCategoryError();
                  setCreateCategoryModalOpen(true);
                }}
                className="flex min-h-11 w-full touch-manipulation items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)]"
              >
                <FolderPlus className="h-4 w-4 shrink-0 text-[var(--faint)]" />
                Add category
              </button>
            </div>
          </div>

          <div className="mx-2 my-4 h-px bg-gradient-to-r from-transparent via-[var(--divider-fade)] to-transparent" />

          <div className="px-1">
            <p className="mb-2.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">AI tools</p>
            <div className="space-y-1">
              <Link
                href="/tutor"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] touch-manipulation"
              >
                <GraduationCap className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                AI Tutor
              </Link>
              <Link
                href="/essay-feedback"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] touch-manipulation"
              >
                <FilePenLine className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                Essay Feedback
              </Link>
              <Link
                href="/citations"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] touch-manipulation"
              >
                <Quote className="h-4 w-4 shrink-0 text-[var(--muted)]" strokeWidth={2} />
                Citations
              </Link>
            </div>
          </div>

          <div className="mx-2 my-4 h-px bg-gradient-to-r from-transparent via-[var(--divider-fade)] to-transparent" />

          <div className="px-1">
            <p className="mb-2.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">Study</p>
            <Link
              href="/study-sets"
              onClick={() => setMobileSidebarOpen(false)}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] touch-manipulation"
            >
              <Bookmark className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              <span className="min-w-0 flex-1 truncate">Study sets</span>
              <span className="shrink-0 tabular-nums text-xs text-[var(--faint)]">{savedStudySets.length}</span>
            </Link>
          </div>
        </nav>
        <div className="shrink-0 space-y-3 border-t border-[var(--sidebar-border)] bg-[var(--sidebar-footer-bg)] p-4 backdrop-blur-sm">
          {plan !== "pro" ? (
            <Link
              href="/billing"
              onClick={() => setMobileSidebarOpen(false)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 py-2.5 text-sm font-semibold text-[var(--inverse-text)] shadow-md shadow-purple-900/20 transition duration-200 hover:from-purple-500 hover:to-blue-500 touch-manipulation"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </Link>
          ) : null}
          <Link
            href="/profile"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex min-h-[3.25rem] items-center gap-3 rounded-xl p-2.5 transition duration-200 hover:bg-[var(--badge-free-bg)] touch-manipulation"
          >
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- OAuth avatar
              <img
                src={session.user.image}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-xl border border-[var(--border-subtle)] object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-gradient-to-br from-purple-500/35 to-blue-500/25 text-xs font-semibold text-[var(--text)]">
                {userInitials(session?.user?.name, session?.user?.email)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--text)]">
                {session?.user?.name?.trim() || session?.user?.email?.split("@")[0] || "Account"}
              </p>
              <div className="mt-1">
                {plan === "pro" ? (
                  <span className="inline-flex rounded-md border border-purple-500/35 bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-200/95">
                    Pro
                  </span>
                ) : (
                  <span className="inline-flex rounded-md border border-[var(--border)] bg-[var(--badge-free-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Free
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--placeholder)]" />
          </Link>
        </div>
      </aside>

      {/* Main content: grid of note cards OR editor panel */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        {!selectedNoteId ? (
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--chrome-30)] px-3 py-3 backdrop-blur-xl md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={mobileSidebarOpen}
              onClick={() => setMobileSidebarOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] transition hover:bg-[var(--btn-default-bg)] touch-manipulation"
            >
              <Menu className="h-6 w-6" strokeWidth={2} aria-hidden />
            </button>
            <StudaraWordmarkLink href="/notes" linkClassName="touch-manipulation" />
            <div className="h-11 w-11 shrink-0" aria-hidden />
          </header>
        ) : null}
        <input
          ref={importDocumentInputRef}
          type="file"
          accept={NOTE_IMPORT_FILE_ACCEPT}
          className="hidden"
          aria-hidden
          onChange={handleImportDocumentChange}
        />
        <input
          ref={analyzeSlidesInputRef}
          type="file"
          accept={SLIDES_ANALYZE_FILE_ACCEPT}
          className="hidden"
          aria-hidden
          onChange={(e) => void handleAnalyzeSlidesChange(e)}
        />
        {plan === "pro" && proHeavyUsage ? (
          <div
            role="status"
            className="shrink-0 border-b border-amber-400/25 bg-amber-500/15 px-4 py-2.5 text-center text-sm text-amber-50/95"
          >
            You&apos;re a heavy user this month — you may experience slightly slower responses as we manage server load.
          </div>
        ) : null}
        {!selectedNoteId &&
        userStats &&
        !userStats.studied_today &&
        userStats.current_streak > 0 &&
        userStats.recent_study_set_id ? (
          <div
            role="status"
            className="flex shrink-0 flex-col gap-2 border-b border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-100/95 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <p className="min-w-0 leading-snug">
              <span className="font-medium text-[var(--text)]">Keep your streak alive!</span>{" "}
              You haven&apos;t studied today yet.
            </p>
            <button
              type="button"
              onClick={() =>
                void loadAndOpenStudySet(
                  userStats.recent_study_set_id!,
                  userStats.recent_study_set_title ?? undefined
                )
              }
              className="shrink-0 rounded-lg border border-violet-400/35 bg-violet-500/20 px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:bg-violet-500/30"
            >
              Open {userStats.recent_study_set_title ? `“${userStats.recent_study_set_title.slice(0, 32)}${userStats.recent_study_set_title.length > 32 ? "…" : ""}”` : "latest set"}
            </button>
          </div>
        ) : null}
        {studySetLoadError ? (
          <div
            role="alert"
            className="flex shrink-0 items-center justify-between gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            <span className="min-w-0">{studySetLoadError}</span>
            <button
              type="button"
              onClick={() => setStudySetLoadError(null)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/20 hover:text-[var(--text)]"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {selectedNoteId ? (
          /* Editor panel (full) */
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-0 md:p-6">
          <EditorPanel
            selectedNote={selectedNote!}
            categories={categories}
            onOpenMobileMenu={() => setMobileSidebarOpen(true)}
            richEditorKey={`${selectedNote!.id}-${editorContentRevision}`}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            editContent={editContent}
            setEditContent={setEditContent}
            suggestBanner={suggestBanner}
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
            onImprove={async () => {
              setToolbarError(null);
              const guided = guidedOnboardingRef.current;
              const onboardingImproveId =
                guided?.step === 2 && guided.sampleNoteId && selectedNote?.id === guided.sampleNoteId
                  ? guided.sampleNoteId
                  : undefined;
              if (onboardingImproveId) guidedImproveInFlightRef.current = true;
              setImproveLoading(true);
              try {
                const res = await fetch("/api/ai/anthropic/improve", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    content: editContent,
                    ...(onboardingImproveId ? { onboardingSampleNoteId: onboardingImproveId } : {}),
                  }),
                });
                const json = (await res.json()) as { improved?: string; error?: string; code?: string };
                if (json.code && res.status === 402) {
                  setUpgradeModal({ show: true, message: json.error ?? "You've used all 5 free improvements this month — upgrade to Pro for unlimited access." });
                  return;
                }
                let improvedHtml: string | null = null;
                if (json.improved) {
                  consumeStreakJson(json);
                  improvedHtml = normalizeImprovedNoteHtml(json.improved);
                } else if (onboardingImproveId && guidedOnboardingRef.current?.persona) {
                  improvedHtml = getOnboardingImprovedFallbackHtml(guidedOnboardingRef.current.persona);
                }
                if (improvedHtml) {
                  setEditContent(improvedHtml);
                  setEditorContentRevision((r) => r + 1);
                  if (selectedNote && (draftNote?.id === selectedNote.id || !draftNote)) {
                    if (draftNote && selectedNote.id === draftNote.id) {
                      setDraftNote((d) =>
                        d
                          ? { ...d, content: improvedHtml, improved_at: new Date().toISOString() }
                          : null
                      );
                    } else {
                      actions.update(selectedNote.id, { content: improvedHtml, record_improvement: true });
                    }
                  }
                  setImproveToast(true);
                  setTimeout(() => setImproveToast(false), 3000);
                  if (onboardingImproveId) {
                    setGuidedOnboarding((prev) =>
                      prev?.step === 2 && prev.sampleNoteId === onboardingImproveId ? { ...prev, step: 3 } : prev
                    );
                  }
                } else {
                  setToolbarError(json.error ?? "Failed to improve note");
                }
              } catch {
                if (onboardingImproveId && guidedOnboardingRef.current?.persona && selectedNote) {
                  const fb = getOnboardingImprovedFallbackHtml(guidedOnboardingRef.current.persona);
                  setEditContent(fb);
                  setEditorContentRevision((r) => r + 1);
                  void actions.update(selectedNote.id, { content: fb });
                  setGuidedOnboarding((prev) =>
                    prev?.step === 2 && prev.sampleNoteId === onboardingImproveId ? { ...prev, step: 3 } : prev
                  );
                } else {
                  setToolbarError("Something went wrong. Please try again.");
                }
              } finally {
                setImproveLoading(false);
                if (onboardingImproveId) guidedImproveInFlightRef.current = false;
              }
            }}
            onGenerateTitle={async () => {
              setToolbarError(null);
              setTitleLoading(true);
              try {
                const res = await fetch("/api/ai/anthropic/generate-title", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: htmlToPlainText(editContent) }),
                });
                const json = (await res.json()) as { title?: string; error?: string };
                if (json.title) {
                  consumeStreakJson(json);
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
                  body: JSON.stringify({ content: htmlToPlainText(editContent) }),
                });
                const json = (await res.json()) as { tags?: string[]; error?: string };
                if (json.tags?.length) {
                  consumeStreakJson(json);
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
            improveButtonRef={improveButtonRef}
            onStudy={() => {
              if (
                onboardingGate === "needs" &&
                guidedOnboarding &&
                guidedOnboarding.step >= 2 &&
                guidedOnboarding.step <= 4
              ) {
                return;
              }
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
                  body: JSON.stringify({ content: htmlToPlainText(editContent) }),
                });
                const json = (await res.json()) as { summary?: string; code?: string; error?: string };
                if (json.code && res.status === 402) {
                  setUpgradeModal({ show: true, message: json.error ?? "Upgrade to Pro" });
                  return;
                }
                if (json.summary) {
                  consumeStreakJson(json);
                  void loadUserStats();
                  setSummaryBelow(json.summary);
                  if (draftNote && selectedNote.id === draftNote.id) {
                    setDraftNote((d) => (d ? { ...d, summarized_at: new Date().toISOString() } : null));
                  } else if (selectedNote && !selectedNote.id.startsWith("draft-")) {
                    void actions.update(selectedNote.id, { record_summarization: true });
                  }
                } else if (json.error) setSummaryBelow(`Error: ${json.error}`);
              } catch {
                setSummaryBelow("Error: Failed to summarize");
              } finally {
                setSummarizeLoading(false);
              }
            }}
            onExportPdf={async () => {
              if (plan !== "pro") {
                setUpgradeModal({ show: true, feature: "export" });
                return;
              }
              const { jsPDF } = await import("jspdf");
              const title = (editTitle || "Untitled").trim() || "note";
              const doc = new jsPDF();
              doc.setFontSize(16);
              doc.text(title, 20, 20);
              doc.setFontSize(11);
              const lines = doc.splitTextToSize(htmlToPlainText(editContent || ""), 170);
              doc.text(lines, 20, 30);
              doc.save(`${title}.pdf`);
            }}
            onExportMd={() => {
              if (plan !== "pro") {
                setUpgradeModal({ show: true, feature: "export" });
                return;
              }
              const title = (editTitle || "Untitled").trim() || "note";
              const blob = new Blob([`# ${title}\n\n${htmlToPlainText(editContent || "")}`], {
                type: "text/markdown",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${title}.md`;
              a.click();
              URL.revokeObjectURL(a.href);
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
                    content: htmlToPlainText(editContent),
                    categoryIds: categories.map((c) => c.id),
                    categoryNames: categories.map((c) => c.name),
                  }),
                });
                const json = (await res.json()) as { category?: { id: string; name: string }; code?: string; error?: string };
                if (json.code && res.status === 402) {
                  setUpgradeModal({ show: true, feature: "autoCategorize" });
                  return;
                }
                if (json.category) {
                  consumeStreakJson(json);
                  setSuggestBanner({ categoryId: json.category.id, name: json.category.name });
                }
                else if (json.error) setUpgradeModal({ show: true, message: json.error });
              } catch {
                setUpgradeModal({ show: true, message: "Failed to suggest category" });
              } finally {
                setAutoCategorizeLoading(false);
              }
            }}
            autoCategorizeLoading={autoCategorizeLoading}
            improveLoading={improveLoading}
            onConceptMap={() => void requestConceptMap()}
            conceptMapLoading={conceptMapLoading}
            conceptMapDisabled={!htmlToPlainText(editContent).trim()}
            titleLoading={titleLoading}
            tagsLoading={tagsLoading}
            suggestTagsChips={suggestTagsChips}
            toolbarError={toolbarError}
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
            shareToolbarSlot={
              selectedNote && !selectedNote.id.startsWith("draft-") ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 gap-1.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
                  title="Share note"
                  aria-label="Share note"
                  onClick={() => setShareNoteModalNoteId(selectedNote.id)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              ) : null
            }
            voiceToNotesToolbar={
              <VoiceToNotesControl
                layout="editor"
                plan={plan}
                categoryId={selectedNote!.category_id ?? null}
                disabled={improveLoading || summarizeLoading}
                onRequirePro={() => setUpgradeModal({ show: true, feature: "voiceTranscription" })}
                onError={(m) => {
                  setToolbarError(m);
                  setVoiceNotesError(m);
                }}
                onSuccess={handleVoiceTranscriptionSuccess}
              />
            }
            studyProgressCompletion={computeStudyProgressCompletion(selectedNote!, {
              hasSummaryInSession: !!summaryBelow,
              hasSavedStudySet: noteHasSavedStudySet(selectedNote!.id, savedStudySets),
            })}
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 pt-2 md:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 md:mb-4">
              <h1 className="text-lg font-semibold text-[var(--text)] md:text-xl">
                {gridSelectMode
                  ? "Select notes"
                  : selectedCategoryId === "all"
                    ? "All Notes"
                    : categories.find((c) => c.id === selectedCategoryId)?.name ?? "Notes"}
              </h1>
              {gridSelectMode ? (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-sm font-medium tabular-nums text-[var(--text)]">
                    {gridSelectedIds.size} selected
                  </span>
                  <Button
                    size="sm"
                    onClick={openMultiStudyMenu}
                    disabled={gridSelectedIds.size === 0}
                    className="gap-1.5 border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-md shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500"
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    Continue to study mode
                  </Button>
                  <Button size="sm" variant="ghost" onClick={exitGridSelection}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {importDocumentMenu("toolbar")}
                  <VoiceToNotesControl
                    layout="toolbar"
                    plan={plan}
                    categoryId={selectedCategoryId === "all" ? null : selectedCategoryId}
                    disabled={importDocLoading || importGoogleDocSaving || slidesAnalyzeLoading}
                    onRequirePro={() => setUpgradeModal({ show: true, feature: "voiceTranscription" })}
                    onError={(m) => {
                      setVoiceNotesError(m);
                      setToolbarError(m);
                    }}
                    onSuccess={handleVoiceTranscriptionSuccess}
                  />
                  <Button
                    size="sm"
                    onClick={startGridSelection}
                    className="gap-1.5 border border-[var(--border)] bg-[var(--btn-default-bg)] text-[var(--text)] hover:bg-[var(--btn-default-hover)]"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Study Multiple
                  </Button>
                  <span className="hidden text-sm text-[var(--muted)] lg:inline">⌘N new · ⌘K search</span>
                </div>
              )}
            </div>
            {userStats && !gridSelectMode ? (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-orange-500/15 to-rose-500/10 p-4 ring-1 ring-orange-400/15">
                  <div className="flex items-center gap-2 text-orange-200/90">
                    <Flame className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Streak</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">{userStats.current_streak}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">day{userStats.current_streak === 1 ? "" : "s"} in a row</p>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-4">
                  <div className="flex items-center gap-2 text-violet-200/85">
                    <FileText className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Notes</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">{userStats.total_notes}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">total created</p>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-4">
                  <div className="flex items-center gap-2 text-cyan-200/85">
                    <Layers className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Flashcards</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">
                    {userStats.flashcard_sets_studied_this_week}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">sets studied this week</p>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-4">
                  <div className="flex items-center gap-2 text-emerald-200/85">
                    <HelpCircle className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Quizzes</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">{userStats.quizzes_this_week}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">completed this week</p>
                </div>
                <div className="col-span-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--input-bg)] p-4 sm:col-span-1">
                  <div className="flex items-center gap-2 text-amber-200/85">
                    <Sparkles className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Summaries</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">{userStats.summarizations_this_month}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">AI summarizations this month</p>
                </div>
              </div>
            ) : null}
            {multiStudyError && (
              <p className="mb-3 text-sm text-red-400">{multiStudyError}</p>
            )}
            {notesLoadError ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 p-12 text-center">
                <p className="max-w-md text-sm text-red-100">{notesLoadError}</p>
                <Button className="mt-6" onClick={() => void actions.refresh()}>
                  Try again
                </Button>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] p-12">
                <FileText className="h-12 w-12 text-[var(--placeholder)]" />
                <p className="mt-4 text-[var(--muted)]">No notes yet</p>
                <p className="mt-1 text-sm text-[var(--faint)]">
                  Click New Note to create your first note, or import a PDF or Word file.
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
                  <Button onClick={openNewNotePicker}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Note
                  </Button>
                  {importDocumentMenu("hero")}
                  <VoiceToNotesControl
                    layout="hero"
                    plan={plan}
                    categoryId={selectedCategoryId === "all" ? null : selectedCategoryId}
                    disabled={importDocLoading || importGoogleDocSaving || slidesAnalyzeLoading}
                    onRequirePro={() => setUpgradeModal({ show: true, feature: "voiceTranscription" })}
                    onError={(m) => {
                      setVoiceNotesError(m);
                      setToolbarError(m);
                    }}
                    onSuccess={handleVoiceTranscriptionSuccess}
                  />
                </div>
              </div>
            ) : (
              <div className="grid flex-1 grid-cols-1 content-start gap-4 overflow-y-auto overflow-x-hidden sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    categories={categories}
                    plan={plan}
                    studyProgressCompletion={computeStudyProgressCompletion(note, {
                      hasSummaryInSession: !!summaryCache[note.id],
                      hasSavedStudySet: noteHasSavedStudySet(note.id, savedStudySets),
                    })}
                    selectMode={gridSelectMode}
                    selected={gridSelectedIds.has(note.id)}
                    onToggleSelect={() => toggleGridNoteSelected(note.id)}
                    summary={summaryCache[note.id]}
                    summaryLoading={summaryLoading.has(note.id)}
                    onSelect={() => {
                      setSelectedNoteId(note.id);
                      setMobileSidebarOpen(false);
                    }}
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
                        body: JSON.stringify({ content: htmlToPlainText(note.content) }),
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
                      if (json.summary) {
                        consumeStreakJson(json);
                        void loadUserStats();
                        setSummaryCache((c) => ({ ...c, [note.id]: json.summary! }));
                        void actions.update(note.id, { record_summarization: true });
                      }
                    }}
                    onExportPdf={async () => {
                      if (plan !== "pro") {
                        setUpgradeModal({ show: true, feature: "export" });
                        return;
                      }
                      const { jsPDF } = await import("jspdf");
                      const doc = new jsPDF();
                      doc.setFontSize(16);
                      doc.text(note.title, 20, 20);
                      doc.setFontSize(11);
                      const lines = doc.splitTextToSize(htmlToPlainText(note.content || ""), 170);
                      doc.text(lines, 20, 30);
                      doc.save(`${note.title || "note"}.pdf`);
                    }}
                    onExportMd={() => {
                      if (plan !== "pro") {
                        setUpgradeModal({ show: true, feature: "export" });
                        return;
                      }
                      const blob = new Blob([`# ${note.title}\n\n${htmlToPlainText(note.content || "")}`], {
                        type: "text/markdown",
                      });
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

      {/* Study modal */}
      {studyModal && (
        <StudyModal
          studyScope={
            studyModal.kind === "saved" ? "saved" : studyModal.kind === "multi" ? "multi" : "single"
          }
          savedSetTitle={studyModal.kind === "saved" ? studyModal.title : undefined}
          reviewDueOnly={studyModal.kind === "saved" && !!studyModal.reviewDueOnly}
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
            flashcardEphemeralStreakRef.current = false;
            if (studyReturnPath) {
              setStudyEmbedDismissed(true);
            }
            setStudyModal(null);
            setStudyMode("menu");
            setFlashcards([]);
            setFlashcardOriginalIndices([]);
            setFlashcardReviewDueTotal(null);
            setFlashcardSessionReviewed(0);
            setFlashcardsSessionComplete(false);
            setFlashcardRatingLoading(false);
            setQuizQuestions([]);
            setCardIndex(0);
            setCardFlipped(false);
            setQuizIndex(0);
            setQuizScore(null);
            setQuizSelected(null);
            setStudyLoading(null);
            setStudySaveLoading(null);
            setStudyError(null);
            void loadUserStats();
            if (studyReturnPath) {
              router.push(studyReturnPath);
            }
          }}
          studyLeaveButtonLabel={studyLeaveButtonLabel}
          savedStudySetId={studyModal.kind === "saved" ? studyModal.setId : null}
          onQuizSessionComplete={(id) => void reportQuizSessionComplete(id)}
          canPersistStudy={studyModal.kind !== "saved"}
          studySaveLoading={studySaveLoading}
          onSaveFlashcards={saveFlashcardSetToSupabase}
          onSaveQuiz={saveQuizSetToSupabase}
          onSelectMode={(m) => setStudyMode(m)}
          onLoadFlashcards={async () => {
            if (studyModal.kind === "multi") {
              await runMultiStudyGeneration("flashcards", studyModal.noteIds);
              return;
            }
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
                primeFlashcardSession(cards);
                setStudyMode("flashcards");
              } else {
                const body: { kind: "flashcards"; content?: string; title?: string } = { kind: "flashcards" };
                if (draftNote && nid === draftNote.id) {
                  body.content = htmlToPlainText(editContent);
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
                consumeStreakJson(j);
                primeFlashcardSession(j.cards ?? []);
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
            if (studyModal.kind === "multi") {
              await runMultiStudyGeneration("quiz", studyModal.noteIds);
              return;
            }
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
                  body.content = htmlToPlainText(editContent);
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
                consumeStreakJson(j);
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
          flashcardReviewDueTotal={flashcardReviewDueTotal}
          flashcardSessionReviewed={flashcardSessionReviewed}
          flashcardsSessionComplete={flashcardsSessionComplete}
          flashcardRatingLoading={flashcardRatingLoading}
          onFlashcardRate={(r) => void handleFlashcardRate(r)}
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

      {studyGuideModal ? (
        <div
          className="fixed inset-0 z-[55] flex flex-col bg-[var(--bg)]"
          role="dialog"
          aria-modal
          aria-labelledby="study-guide-title"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--chrome-40)] px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">Study guide</p>
              <h2 id="study-guide-title" className="truncate text-lg font-semibold text-[var(--text)] sm:text-xl">
                {studyGuideModal.categoryName}
              </h2>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!studyGuideText || studyGuideLoading}
                className="gap-1.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
                onClick={() => void downloadStudyGuidePdf()}
              >
                <Download className="h-4 w-4" />
                PDF
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!studyGuideText || studyGuideLoading || saveStudyGuideLoading}
                className="gap-1.5 border-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-[var(--inverse-text)]"
                onClick={() => void saveStudyGuideToNote()}
              >
                {saveStudyGuideLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Save to Notes
              </Button>
              <button
                type="button"
                onClick={closeStudyGuideModal}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
            {studyGuideLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24">
                <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
                <p className="text-sm text-[var(--muted)]">Generating your study guide…</p>
              </div>
            ) : studyGuideError ? (
              <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
                <p className="text-sm text-red-100">{studyGuideError}</p>
                <Button type="button" className="mt-4" variant="ghost" onClick={closeStudyGuideModal}>
                  Close
                </Button>
              </div>
            ) : studyGuideText ? (
              <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--chrome-25)] p-5 sm:p-8">
                <TutorMarkdown content={studyGuideText} className="text-[0.95rem] leading-relaxed" />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {streakMilestone ? (
        <StreakMilestoneModal milestone={streakMilestone} onClose={() => setStreakMilestone(null)} />
      ) : null}

      {/* Upgrade modal */}
      {upgradeModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] backdrop-blur-sm">
          <Card className="mx-4 max-w-sm p-6">
            <h3 className="text-lg font-semibold text-[var(--text)]">Upgrade to Pro</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {upgradeModal.feature && PRO_FEATURE_DESCRIPTIONS[upgradeModal.feature]
                ? `${PRO_FEATURE_DESCRIPTIONS[upgradeModal.feature]} This feature is Pro only.`
                : upgradeModal.message ?? "Upgrade to Pro for more features."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/billing"
                onClick={() => setUpgradeModal({ show: false })}
                className="flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 py-2.5 text-sm font-semibold text-[var(--inverse-text)] shadow-lg transition hover:from-purple-500 hover:to-blue-500"
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
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--chrome-90)] px-4 py-2.5 text-sm text-[var(--text)] shadow-lg backdrop-blur">
          Notes improved
        </div>
      )}
      {linkCopiedToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--chrome-90)] px-4 py-2.5 text-sm text-[var(--text)] shadow-lg backdrop-blur">
          Link copied!
        </div>
      )}
      {shareNoteModalNoteId ? (
        <ShareResourceModal
          open
          onClose={() => setShareNoteModalNoteId(null)}
          resourceType="note"
          resourceId={shareNoteModalNoteId}
          title="Share note"
          onCopied={() => setLinkCopiedToast(true)}
        />
      ) : null}

      <ConceptMapModal
        open={conceptMapModalOpen}
        onClose={() => {
          setConceptMapModalOpen(false);
          setConceptMapGraph(null);
        }}
        graph={conceptMapGraph}
        sourceTitle={editTitle || "Untitled"}
        onSaveAsNote={saveConceptMapAsNote}
        saveNoteLoading={conceptMapSaveNoteLoading}
      />

      {saveErrorMessage ? (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 flex max-w-[min(100vw-2rem,24rem)] -translate-x-1/2 items-start gap-3 rounded-lg border border-red-500/35 bg-[#1a0a0f]/95 px-4 py-3 text-sm text-red-100 shadow-lg backdrop-blur"
        >
          <span className="min-w-0 flex-1 leading-snug">{saveErrorMessage}</span>
          <button
            type="button"
            onClick={() => clearSaveErrorMessage()}
            className="shrink-0 rounded-md p-1 text-red-300 transition hover:bg-red-500/20 hover:text-[var(--text)]"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

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
      <NoteTemplatePickerModal
        open={newNoteTemplateModalOpen}
        onClose={() => setNewNoteTemplateModalOpen(false)}
        onBlankNote={() => createNewNoteWithInitial({ title: "Untitled", content: "" })}
        onPickTemplate={(id: NoteTemplateId) =>
          createNewNoteWithInitial({
            title: noteTemplateDefaultTitle(id),
            content: noteTemplateHtml(id),
          })
        }
      />

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

      {onboardingGate === "needs" && guidedOnboarding ? (
        <GuidedOnboarding
          step={guidedOnboarding.step}
          persona={guidedOnboarding.persona}
          onPersonaChange={(p) =>
            setGuidedOnboarding((g) => (g && g.step === 1 ? { ...g, persona: p } : g))
          }
          onWelcomeContinue={() => void handleGuidedWelcomeContinue()}
          welcomeLoading={guidedWelcomeLoading}
          onSkip={() => void skipOrCompleteGuidedOnboarding()}
          skipDisabled={guidedWelcomeLoading || guidedFinishLoading}
          onFinishDashboard={() => void finishGuidedOnboardingDashboard()}
          onTutorContinue={() =>
            setGuidedOnboarding((g) => (g && g.step === 5 ? { ...g, step: 6 } : g))
          }
          finishLoading={guidedFinishLoading}
          improveButtonRef={improveButtonRef}
          showImproveCoach={guidedOnboarding.step === 2}
          showMagicCoach={guidedOnboarding.step === 3}
          showFlashcardCoach={
            guidedOnboarding.step === 4 && studyMode === "flashcards" && flashcards.length > 0
          }
          showTutorCoach={guidedOnboarding.step === 5}
          currentStreak={userStats?.current_streak ?? 1}
        />
      ) : null}
    </div>
  );
}

function EditorPanel({
  selectedNote,
  categories,
  richEditorKey,
  onOpenMobileMenu,
  editTitle,
  setEditTitle,
  editContent,
  setEditContent,
  suggestBanner,
  summaryBelow,
  summaryLoading,
  autoCategorizeLoading,
  improveLoading,
  onConceptMap,
  conceptMapLoading,
  conceptMapDisabled,
  titleLoading,
  tagsLoading,
  suggestTagsChips,
  toolbarError,
  onBack,
  onUpdate,
  onSuggestApply,
  onSuggestDismiss,
  onImprove,
  improveButtonRef,
  onGenerateTitle,
  onSuggestTags,
  onStudy,
  onClaudeSummarize,
  onAutoCategorize,
  onExportPdf,
  onExportMd,
  onSuggestTagAccept,
  onSuggestTagDismiss,
  onToolbarErrorDismiss,
  shareToolbarSlot,
  voiceToNotesToolbar,
  studyProgressCompletion,
  onDeleteRequest,
}: {
  selectedNote: Note;
  categories: Category[];
  richEditorKey: string;
  onOpenMobileMenu?: () => void;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editContent: string;
  setEditContent: (v: string) => void;
  suggestBanner: { categoryId: string; name: string } | null;
  summaryBelow: string | null;
  summaryLoading: boolean;
  autoCategorizeLoading: boolean;
  improveLoading: boolean;
  onConceptMap: () => void;
  conceptMapLoading: boolean;
  conceptMapDisabled: boolean;
  titleLoading: boolean;
  tagsLoading: boolean;
  suggestTagsChips: string[] | null;
  toolbarError: string | null;
  onBack: () => void;
  onUpdate: (patch: Partial<Pick<Note, "title" | "content" | "category_id" | "tags">>) => void;
  onSuggestApply: () => void;
  onSuggestDismiss: () => void;
  onImprove: () => void;
  improveButtonRef?: React.RefObject<HTMLElement | null>;
  onGenerateTitle: () => void;
  onSuggestTags: () => void;
  onStudy: () => void;
  onClaudeSummarize: () => void;
  onAutoCategorize: () => void;
  onExportPdf: () => void | Promise<void>;
  onExportMd: () => void;
  onSuggestTagAccept: (tag: string) => void;
  onSuggestTagDismiss: () => void;
  onToolbarErrorDismiss: () => void;
  shareToolbarSlot?: React.ReactNode;
  voiceToNotesToolbar?: React.ReactNode;
  studyProgressCompletion: StudyProgressCompletion;
  onDeleteRequest: () => void;
}) {
  function handleStudyProgressStep(step: StudyProgressStepId) {
    switch (step) {
      case "write":
        requestAnimationFrame(() => {
          document.querySelector<HTMLElement>(".studara-tiptap")?.focus();
        });
        break;
      case "improve":
        void onImprove();
        break;
      case "summarize":
        void onClaudeSummarize();
        break;
      case "study":
        onStudy();
        break;
      default:
        break;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-[var(--border)] bg-[var(--chrome-20)] backdrop-blur-xl md:rounded-2xl md:border">
      <NoteStudyProgressTrail
        completion={studyProgressCompletion}
        onStepPress={handleStudyProgressStep}
        disabled={improveLoading || summaryLoading}
      />
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2 md:gap-4 md:px-4 md:py-3">
        {onOpenMobileMenu ? (
          <button
            type="button"
            aria-label="Open menu"
            onClick={onOpenMobileMenu}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] transition hover:bg-[var(--btn-default-bg)] md:hidden touch-manipulation"
          >
            <Menu className="h-6 w-6" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--input-bg)] hover:text-[var(--text)] touch-manipulation md:min-h-0 md:rounded-lg md:px-2 md:py-1.5"
        >
          <ChevronRight className="h-4 w-4 rotate-180 shrink-0" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-x-auto overflow-y-hidden py-1 [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible md:py-0 [&::-webkit-scrollbar]:hidden">
          <select
            value={selectedNote.category_id ?? ""}
            onChange={(e) => onUpdate({ category_id: e.target.value || null })}
            className="min-h-11 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2 py-2 text-sm text-[var(--text)] md:min-h-0 md:py-1.5"
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
          {shareToolbarSlot}
          {voiceToNotesToolbar}
          <Button size="sm" variant="ghost" onClick={() => void onClaudeSummarize()} disabled={summaryLoading}>
            {summaryLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Summarize
          </Button>
          {categories.length >= 2 && (
            <Button size="sm" variant="ghost" onClick={() => void onAutoCategorize()} disabled={autoCategorizeLoading}>
              {autoCategorizeLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Tag className="mr-1.5 h-3.5 w-3.5" />}
              Auto-categorize
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onStudy}>
            <BookOpen className="mr-1.5 h-3.5 w-3.5" />
            Study
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void onExportPdf()} className="border border-[var(--border)] bg-[var(--btn-default-bg)] text-[var(--text)] hover:bg-[var(--btn-default-hover)]">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={onExportMd} className="border border-[var(--border)] bg-[var(--btn-default-bg)] text-[var(--text)] hover:bg-[var(--btn-default-hover)]">
            Markdown
          </Button>
        </div>
        <button
          type="button"
          onClick={onDeleteRequest}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-red-500/15 hover:text-red-300 touch-manipulation md:h-auto md:w-auto md:rounded-lg md:p-2"
          title="Delete note"
          aria-label="Delete note"
        >
          <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
        </button>
      </div>
      {suggestBanner && (
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-purple-500/10 px-4 py-2 text-sm">
          <span className="text-[var(--text)]">
            We suggest: <strong>{suggestBanner.name}</strong> — Apply?
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={onSuggestApply}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={onSuggestDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
      <div className="border-b border-[var(--border)] px-4 py-3 md:px-6 md:py-4">
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full min-h-11 bg-transparent text-xl font-semibold text-[var(--text)] outline-none placeholder:text-[var(--placeholder)] md:text-2xl"
          placeholder="Note title"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <NoteRichTextEditor
          key={richEditorKey}
          noteId={selectedNote.id}
          initialHtml={editContent}
          onHtmlChange={setEditContent}
          className="min-h-0 flex-1"
        />
        {summaryBelow && (
          <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">Summary</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">{summaryBelow}</p>
          </div>
        )}
        {toolbarError && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-200">{toolbarError}</p>
            <button type="button" onClick={onToolbarErrorDismiss} className="text-red-300 hover:text-[var(--text)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {suggestTagsChips && suggestTagsChips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Suggested tags:</span>
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
              type="button"
              onClick={onSuggestTagDismiss}
              className="rounded px-2 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--text)]"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <span ref={improveButtonRef as React.RefObject<HTMLSpanElement>} className="inline-flex">
            <Button size="sm" variant="ghost" onClick={() => void onImprove()} disabled={improveLoading}>
              {improveLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Improve
            </Button>
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={onConceptMap}
            disabled={conceptMapLoading || conceptMapDisabled}
            title={conceptMapDisabled ? "Add note content to generate a concept map" : undefined}
          >
            {conceptMapLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Network className="mr-1.5 h-3.5 w-3.5" />
            )}
            Concept Map
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void onGenerateTitle()} disabled={titleLoading}>
            {titleLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Generate Title
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void onSuggestTags()} disabled={tagsLoading}>
            {tagsLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Suggest Tags
          </Button>
        </div>
      </div>
    </div>
  );
}

function NoteCard({
  note,
  categories,
  plan: _plan,
  studyProgressCompletion,
  selectMode = false,
  selected = false,
  onToggleSelect,
  summary,
  summaryLoading,
  onSelect,
  onUpdateCategory: _onUpdateCategory,
  onTogglePin,
  onRequestDelete,
  onSummarize,
  onExportPdf,
  onExportMd,
  onStudy,
  exportOpen,
  onExportToggle,
  setUpgradeModal: _setUpgradeModal,
}: {
  note: Note;
  categories: Category[];
  plan: string;
  studyProgressCompletion: StudyProgressCompletion;
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
  const preview = noteContentPreview(note.content || "");

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
        "group max-w-full overflow-x-hidden rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] p-5 transition hover:border-purple-500/30 hover:bg-[var(--btn-default-bg)]",
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
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--border)] bg-[var(--btn-default-bg)] text-purple-500 focus:ring-purple-500"
            aria-label={selected ? "Deselect note" : "Select note"}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="flex-1 truncate font-semibold text-[var(--text)]">{note.title || "Untitled"}</h3>
            {!selectMode && (
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin();
                  }}
                  className="rounded p-1 text-[var(--muted)] hover:text-amber-400"
                >
                  <Pin className={cn("h-3.5 w-3.5", note.pinned && "fill-amber-400 text-amber-400")} />
                </button>
                <div className="relative" data-note-export-root={note.id}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportToggle();
                    }}
                    className="rounded p-1 text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--chrome-90)] py-1 shadow-xl">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportPdf();
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
                      >
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportMd();
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
                      >
                        Export Markdown
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStudy();
                  }}
                  className="rounded p-1 text-[var(--muted)] hover:text-[var(--text)]"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{preview || "No content"}</p>
          <div className="mt-3" title="Study progress">
            <NoteStudyProgressBar completion={studyProgressCompletion} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                categoryColor ? "text-[var(--text)]" : categoryName === "Uncategorized" ? "bg-[var(--btn-default-bg)] text-[var(--muted)]" : "bg-purple-500/20 text-purple-300"
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
            <span className="text-xs text-[var(--muted)]">{formattedDate}</span>
          </div>
          {(note.tags ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(note.tags ?? []).map((t) => (
                <Badge key={t} className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}
          {summary && <p className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">{summary}</p>}
          {summaryLoading && <Loader2 className="mt-2 h-3 w-3 animate-spin text-[var(--muted)]" />}
          {!selectMode && !summary && !summaryLoading && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onSummarize(); }} className="mt-2 text-xs text-purple-400 hover:underline">
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
              className="fixed z-[80] min-w-[160px] rounded-lg border border-[var(--border)] bg-[var(--chrome-90)] py-1 shadow-xl"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              onPointerDown={(e) => e.stopPropagation()}
              role="menu"
              aria-label="Note actions"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[var(--btn-default-bg)]"
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
  icon,
  count,
  selected,
  onClick,
  onStudyGuide,
  onRename,
  onDelete,
}: {
  id: string;
  name: string;
  color?: string;
  icon?: React.ReactNode;
  count?: number;
  selected: boolean;
  onClick: () => void;
  onStudyGuide?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const [menu, setMenu] = React.useState(false);
  const isAll = id === "all";
  return (
    <div className="group relative flex w-full min-w-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 touch-manipulation items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition duration-200",
          selected
            ? "bg-gradient-to-r from-purple-500/18 to-blue-500/10 text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(168,85,247,0.25)]"
            : "text-[var(--muted)] hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)]"
        )}
      >
        {icon ? (
          <span className="shrink-0">{icon}</span>
        ) : color ? (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[var(--border)]"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        ) : (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/25 ring-2 ring-[var(--border)]" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
        {count !== undefined ? (
          <span
            className={cn(
              "shrink-0 tabular-nums text-xs",
              selected ? "text-[var(--muted)]" : "text-[var(--placeholder)]"
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
      {onStudyGuide && !isAll ? (
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg text-violet-300/90 opacity-90 transition hover:bg-violet-500/15 hover:text-violet-200 md:opacity-0 md:group-hover:opacity-100"
          aria-label={`Generate study guide for ${name}`}
          title="Generate study guide (Pro)"
          onClick={(e) => {
            e.stopPropagation();
            onStudyGuide();
          }}
        >
          <Sparkles className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
      {!isAll && (onRename || onDelete) ? (
        <button
          type="button"
          className="flex h-9 w-6 shrink-0 touch-manipulation items-center justify-center rounded-lg text-[var(--faint)] opacity-90 transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--muted)] md:opacity-0 md:group-hover:opacity-100"
          aria-label={`Category actions for ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {menu && !isAll && (
        <div className="absolute left-0 top-full z-10 mt-1 w-full min-w-[8rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--chrome-90)] py-1 shadow-xl">
          {onRename && (
            <button
              type="button"
              onClick={() => {
                onRename();
                setMenu(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--btn-default-bg)]"
            >
              Rename
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete();
                setMenu(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-red-400 transition hover:bg-[var(--btn-default-bg)]"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StreakMilestoneModal({
  milestone,
  onClose,
}: {
  milestone: StreakMilestone;
  onClose: () => void;
}) {
  const copy: Record<StreakMilestone, { title: string; subtitle: string }> = {
    7: { title: "One week strong", subtitle: "7-day study streak" },
    30: { title: "Building mastery", subtitle: "30-day study streak" },
    100: { title: "Legendary focus", subtitle: "100-day study streak" },
  };
  const { title, subtitle } = copy[milestone];
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--scrim-heavy)] p-4 backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-labelledby="streak-milestone-title"
    >
      <Card className="studara-streak-milestone-enter relative w-full max-w-sm overflow-hidden border border-violet-400/25 bg-[var(--modal-surface)] p-8 text-center shadow-2xl shadow-violet-900/20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[...Array(12)].map((_, i) => (
            <span
              key={i}
              className="studara-streak-confetti-bit absolute h-2 w-2 rounded-full opacity-70"
              style={{
                left: `${8 + (i * 7) % 84}%`,
                top: `${12 + ((i * 13) % 40)}%`,
                background: i % 3 === 0 ? "rgb(167, 139, 250)" : i % 3 === 1 ? "rgb(34, 211, 238)" : "rgb(251, 191, 36)",
                animationDelay: `${i * 0.06}s`,
              }}
            />
          ))}
        </div>
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/40 via-orange-500/35 to-rose-500/30 ring-2 ring-amber-300/30">
          <Flame className="h-11 w-11 text-amber-100" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="relative mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/90">Milestone</p>
        <h2 id="streak-milestone-title" className="relative mt-2 text-2xl font-bold text-[var(--text)]">
          {title}
        </h2>
        <p className="relative mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        <p className="relative mt-4 text-5xl font-black tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-200 to-rose-200">
          {milestone}
        </p>
        <Button
          type="button"
          className="relative mt-8 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)]"
          onClick={onClose}
        >
          Keep going
        </Button>
      </Card>
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
  reviewDueOnly = false,
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
  flashcardReviewDueTotal,
  flashcardSessionReviewed,
  flashcardsSessionComplete,
  flashcardRatingLoading,
  onFlashcardRate,
  onQuizSelect,
  onQuizNext,
  onQuizTryAgain,
  canPersistStudy,
  studySaveLoading,
  onSaveFlashcards,
  onSaveQuiz,
  savedStudySetId = null,
  onQuizSessionComplete,
  studyLeaveButtonLabel = "Back to notes",
}: {
  studyScope?: "single" | "multi" | "saved";
  savedSetTitle?: string;
  reviewDueOnly?: boolean;
  savedStudySetId?: string | null;
  onQuizSessionComplete?: (savedSetId: string | null) => void;
  studyLeaveButtonLabel?: string;
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
  flashcardReviewDueTotal: number | null;
  flashcardSessionReviewed: number;
  flashcardsSessionComplete: boolean;
  flashcardRatingLoading: boolean;
  onFlashcardRate: (rating: FlashcardRating) => void;
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

  const quizWasDoneRef = React.useRef(false);
  React.useEffect(() => {
    const isDone = mode === "quiz" && done;
    if (isDone && !quizWasDoneRef.current) {
      onQuizSessionComplete?.(savedStudySetId ?? null);
    }
    quizWasDoneRef.current = isDone;
  }, [mode, done, savedStudySetId, onQuizSessionComplete]);

  if (mode === "menu") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-md">
        <Card className="studara-study-modal-enter relative mx-auto w-full max-w-2xl border border-[var(--border)] bg-[var(--modal-surface)] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 ring-1 ring-[var(--border)]">
              <GraduationCap className="h-8 w-8 text-violet-200" strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text)]">Study Mode</h2>
            <p className="mt-1.5 max-w-md text-sm text-[var(--muted)]">
              {studyScope === "multi"
                ? "We’ll combine your selected notes. Choose flashcards or a quiz to generate."
                : "Choose how you want to practice — flip through cards or test yourself with a quiz."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] sm:right-6 sm:top-6"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <div className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--modal-surface)] p-5 shadow-inner sm:min-h-[220px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-200">
                <SquareStack className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">Flashcards</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                Key terms and definitions you can flip through at your own pace.
              </p>
              <Button
                type="button"
                onClick={onLoadFlashcards}
                disabled={!!loading}
                className="mt-5 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500"
              >
                {loading === "flashcards" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <SquareStack className="mr-2 h-4 w-4 opacity-90" />
                )}
                {loading === "flashcards" ? "Generating…" : "Start flashcards"}
              </Button>
            </div>

            <div className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--modal-surface)] p-5 shadow-inner sm:min-h-[220px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
                <HelpCircle className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">Quiz</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--muted)]">
                Multiple choice questions to check your understanding and track progress.
              </p>
              <Button
                type="button"
                onClick={onLoadQuiz}
                disabled={!!loading}
                className="mt-5 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500"
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
    const totalCards = flashcards.length;

    if (flashcardsSessionComplete) {
      return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[var(--scrim)] p-0 backdrop-blur-md sm:items-center sm:p-4">
          <Card className="flex max-h-dvh min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-none border-0 border-[var(--border)] bg-[var(--modal-surface)] p-6 shadow-2xl backdrop-blur-sm sm:rounded-2xl sm:border max-sm:flex-1">
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/35 to-violet-500/25 ring-1 ring-[var(--border)]">
                <SquareStack className="h-8 w-8 text-emerald-200" strokeWidth={1.5} />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-[var(--text)]">Session complete</h3>
              <p className="mt-2 max-w-xs text-sm text-[var(--muted)]">
                {reviewDueOnly
                  ? `You reviewed all ${totalCards} due card${totalCards === 1 ? "" : "s"}. Great work — spaced repetition will surface them again when it’s time.`
                  : "Nice work. Keep rating cards when you flip them to build your personal review schedule."}
              </p>
              <Button type="button" className="mt-8 w-full max-w-xs border-0 bg-gradient-to-r from-violet-600 to-indigo-600" onClick={onClose}>
                Done
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    const card = flashcards[cardIndex];
    return (
      <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[var(--scrim)] p-0 backdrop-blur-md sm:items-center sm:p-4">
        <Card className="flex max-h-dvh min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-none border-0 border-[var(--border)] bg-[var(--modal-surface)] shadow-2xl backdrop-blur-sm sm:max-h-[min(90dvh,880px)] sm:rounded-2xl sm:border sm:p-6 max-sm:flex-1">
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-0 sm:pb-0 sm:pt-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight text-[var(--text)] sm:text-sm">Flashcards</h3>
              {studyScope === "multi" && (
                <p className="mt-1 text-xs text-violet-300/90">From multiple notes</p>
              )}
              {studyScope === "saved" && savedSetTitle && (
                <p className="mt-1 line-clamp-2 text-xs text-emerald-300/90">{savedSetTitle}</p>
              )}
              {reviewDueOnly && (
                <p className="mt-1 text-xs font-medium text-amber-200/90">Due for review today</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] touch-manipulation sm:h-auto sm:w-auto sm:rounded-lg sm:p-1.5"
              aria-label="Close"
            >
              <X className="h-6 w-6 sm:h-5 sm:w-5" />
            </button>
          </div>

          {error && (
            <p className="mx-4 mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200 sm:mx-0">
              {error}
            </p>
          )}

          {flashcardReviewDueTotal != null && flashcardReviewDueTotal > 0 ? (
            <div className="mt-3 px-4 sm:px-0">
              <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                <span>Due today</span>
                <span className="tabular-nums">
                  {flashcardSessionReviewed} / {flashcardReviewDueTotal} reviewed
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--btn-default-bg)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, (flashcardSessionReviewed / flashcardReviewDueTotal) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          <p className="mt-3 px-4 text-center text-sm text-[var(--muted)] sm:px-0">Tap the card to flip</p>

          {/* Fixed-size flip card: full width, taller on mobile for easy tapping */}
          <div className="mt-3 min-h-0 flex-1 px-3 sm:px-0">
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
                    "relative min-h-[min(48dvh,320px)] w-full cursor-pointer transition-transform duration-500 ease-out [transform-style:preserve-3d] sm:min-h-[220px]",
                    cardFlipped && "[transform:rotateY(180deg)]"
                  )}
                  aria-label={cardFlipped ? "Show question (front)" : "Show answer (back)"}
                >
                  {/* Front — term / question */}
                  <div
                    className="absolute inset-0 flex min-h-[min(48dvh,320px)] flex-col items-center justify-center overflow-y-auto rounded-[15px] border border-[var(--border-subtle)] bg-[var(--modal-surface)] px-5 py-8 text-center [backface-visibility:hidden] [transform:rotateY(0deg)] sm:min-h-[220px] sm:py-6"
                  >
                    <span className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-indigo-300">
                      Question
                    </span>
                    <p className="max-w-full text-lg font-medium leading-relaxed text-[var(--text)] [overflow-wrap:anywhere] sm:text-base">
                      {card.front}
                    </p>
                  </div>
                  {/* Back — definition / answer */}
                  <div
                    className="absolute inset-0 flex min-h-[min(48dvh,320px)] flex-col items-center justify-center overflow-y-auto rounded-[15px] border border-[var(--border-subtle)] bg-[var(--modal-surface)] px-5 py-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)] sm:min-h-[220px] sm:py-6"
                  >
                    <span className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-violet-300">
                      Answer
                    </span>
                    <p className="max-w-full text-lg leading-relaxed text-[var(--text)] [overflow-wrap:anywhere] sm:text-base">
                      {card.back}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 px-4 text-center text-base font-medium tabular-nums text-[var(--muted)] sm:px-0 sm:text-sm">
            {cardIndex + 1} of {totalCards}
          </p>

          {cardFlipped ? (
            <div className="mt-4 space-y-2 px-4 sm:px-0">
              <p className="text-center text-xs text-[var(--muted)]">How well did you recall this?</p>
              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  disabled={flashcardRatingLoading}
                  onClick={() => onFlashcardRate("hard")}
                  className="min-h-12 flex-1 rounded-xl border border-red-500/40 bg-red-500/15 px-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:opacity-50 touch-manipulation"
                >
                  Hard
                </button>
                <button
                  type="button"
                  disabled={flashcardRatingLoading}
                  onClick={() => onFlashcardRate("good")}
                  className="min-h-12 flex-1 rounded-xl border border-amber-500/45 bg-amber-500/15 px-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-50 touch-manipulation"
                >
                  Good
                </button>
                <button
                  type="button"
                  disabled={flashcardRatingLoading}
                  onClick={() => onFlashcardRate("easy")}
                  className="min-h-12 flex-1 rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50 touch-manipulation"
                >
                  Easy
                </button>
              </div>
            </div>
          ) : null}

          {canPersistStudy && (
            <Button
              type="button"
              className="mx-4 mt-3 w-[calc(100%-2rem)] border-0 bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-base font-medium text-[var(--inverse-text)] shadow-md shadow-violet-500/20 disabled:opacity-50 sm:mx-0 sm:w-full sm:py-2 sm:text-sm"
              onClick={() => void onSaveFlashcards()}
              disabled={studySaveLoading === "flashcards"}
            >
              {studySaveLoading === "flashcards" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save to Study Sets
            </Button>
          )}

          <div className="mt-3 flex w-full shrink-0 items-stretch justify-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-0 sm:pb-0">
            <Button
              type="button"
              variant="ghost"
              className="min-h-12 min-w-0 flex-1 gap-2 border border-[var(--border)] bg-[var(--input-bg)] px-4 text-base text-[var(--text)] hover:bg-[var(--btn-default-bg)] touch-manipulation sm:min-h-10 sm:min-w-[7.5rem] sm:flex-initial sm:text-sm"
              onClick={onCardPrev}
              disabled={cardIndex === 0}
            >
              <ChevronLeft className="h-5 w-5 shrink-0 opacity-80 sm:mr-1 sm:h-4 sm:w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-12 min-w-0 flex-1 gap-2 border border-[var(--border)] bg-[var(--input-bg)] px-4 text-base text-[var(--text)] hover:bg-[var(--btn-default-bg)] touch-manipulation sm:min-h-10 sm:min-w-[7.5rem] sm:flex-initial sm:text-sm"
              onClick={onCardNext}
              disabled={cardIndex === totalCards - 1}
            >
              Next
              <ChevronRight className="h-5 w-5 shrink-0 opacity-80 sm:ml-1 sm:h-4 sm:w-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-md">
          <Card className="studara-study-modal-enter mx-auto w-full max-w-md border border-[var(--border)] bg-[var(--modal-surface)] p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/35 to-cyan-500/25 ring-1 ring-[var(--border)]">
              <GraduationCap className="h-8 w-8 text-violet-100" strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-[var(--text)]">Quiz complete</h2>
            <p className="mt-2 text-5xl font-bold tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-cyan-300">
              {finalScore}/{total}
            </p>
            <p className="mt-1 text-lg font-medium text-[var(--text)]">{pct}% correct</p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{quizEncouragementMessage(finalScore, total)}</p>
            {error && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>
            )}
            <div className="mt-8 flex flex-col gap-3">
              {canPersistStudy && (
                <Button
                  type="button"
                  className="w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-lg shadow-violet-500/25"
                  onClick={() => void onSaveQuiz()}
                  disabled={studySaveLoading === "quiz"}
                >
                  {studySaveLoading === "quiz" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save to Study Sets
                </Button>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  onClick={onQuizTryAgain}
                  className="w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-md shadow-violet-500/20 sm:w-auto sm:min-w-[140px]"
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="w-full border border-[var(--border)] bg-[var(--badge-free-bg)] text-[var(--text)] hover:bg-[var(--btn-default-bg)] sm:w-auto sm:min-w-[140px]"
                >
                  {studyLeaveButtonLabel}
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
      <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[var(--scrim)] p-0 backdrop-blur-md sm:items-center sm:p-4">
        <Card className="mx-auto flex max-h-dvh min-h-0 w-full max-w-lg flex-col overflow-y-auto overflow-x-hidden rounded-none border-0 border-[var(--border)] bg-[var(--modal-surface)] shadow-2xl backdrop-blur-sm sm:max-h-[min(92dvh,900px)] sm:rounded-2xl sm:border sm:p-6">
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 sm:px-0 sm:pt-0">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--faint)]">Quiz</p>
              <p className="mt-1 text-sm font-medium tabular-nums text-[var(--muted)]">
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
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--btn-default-bg)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${((quizIndex + 1) / total) * 100}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] touch-manipulation sm:h-auto sm:w-auto sm:rounded-lg sm:p-1.5"
              aria-label="Close"
            >
              <X className="h-6 w-6 sm:h-5 sm:w-5" />
            </button>
          </div>

          <div className="mt-5 w-full flex-1 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-0 sm:pb-0">
            <div className="rounded-2xl bg-gradient-to-br from-violet-500/50 via-indigo-500/35 to-cyan-500/40 p-[1px] shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)]">
              <div className="flex min-h-[min(52dvh,360px)] flex-col rounded-[15px] border border-[var(--border-subtle)] bg-[var(--modal-surface)] p-4 sm:min-h-[340px] sm:p-6">
                <h3 className="text-center text-lg font-bold leading-snug text-[var(--text)] [overflow-wrap:anywhere] sm:text-lg">
                  {q.question}
                </h3>
                <div className="mt-5 flex flex-1 flex-col gap-3">
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
                          "flex min-h-14 w-full touch-manipulation items-start gap-3 rounded-xl border px-4 py-4 text-left text-base leading-snug transition sm:min-h-0 sm:py-3 sm:text-sm",
                          !revealed && String(opt).trim() && "border-[var(--border)] bg-white/[0.03] hover:border-violet-500/40 hover:bg-violet-500/10",
                          !String(opt).trim() && "cursor-not-allowed border-dashed border-[var(--border-subtle)] bg-[var(--input-bg)] opacity-40",
                          revealed && isCorrect && "border-emerald-500/70 bg-emerald-500/15 text-emerald-100",
                          revealed && !isCorrect && isPicked && "border-red-500/80 bg-red-500/15 text-red-100",
                          revealed && !isCorrect && !isPicked && "border-[var(--sidebar-border)] opacity-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold sm:h-7 sm:w-7 sm:text-xs",
                            !revealed && "bg-[var(--btn-default-bg)] text-[var(--text)]",
                            revealed && isCorrect && "bg-emerald-500/30 text-emerald-100",
                            revealed && !isCorrect && isPicked && "bg-red-500/30 text-red-100",
                            revealed && !isCorrect && !isPicked && "bg-[var(--input-bg)] text-[var(--faint)]"
                          )}
                        >
                          {optionLetters[i]}
                        </span>
                        <span className="pt-0.5 leading-relaxed text-[var(--text)] [overflow-wrap:anywhere]">
                          {String(opt).trim() || "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {showExplain && fallbackExplain && (
                  <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-3 py-2.5 text-center text-xs leading-relaxed text-[var(--muted)] [overflow-wrap:anywhere]">
                    {fallbackExplain}
                  </div>
                )}

                {quizSelected !== null && (
                  <div className="mt-auto pt-4">
                    <Button
                      type="button"
                      className="min-h-12 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-base font-medium text-[var(--inverse-text)] shadow-md shadow-violet-500/20 touch-manipulation sm:min-h-10 sm:text-sm"
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
