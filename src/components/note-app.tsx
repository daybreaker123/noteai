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
import { captureAnalytics } from "@/lib/analytics";
import { sanitizeGeneratedNoteTitle } from "@/lib/sanitize-note-title";
import { NOTE_IMPORT_FILE_ACCEPT, SLIDES_ANALYZE_FILE_ACCEPT } from "@/lib/note-import-utils";
import {
  ensureEditorHtml,
  htmlToPlainText,
  normalizeImprovedNoteHtml,
  noteContentPreview,
} from "@/lib/note-content-html";
import type { ConceptMapData } from "@/lib/concept-map-types";
import { conceptMapToNotePlainText, parseConceptMapPayload } from "@/lib/concept-map-types";
import { ConceptMapModal } from "@/components/concept-map-modal";
import { studyGuideMarkdownToHtml } from "@/lib/study-guide-markdown";
import { TutorMarkdown, summaryMarkdownLayoutClassName } from "@/components/tutor-markdown";
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
import {
  VoiceToNotesControl,
  type VoiceTranscriptionSuccessPayload,
} from "@/components/voice-to-notes-control";
import { ShareResourceModal } from "@/components/share-resource-modal";
import { noteTemplateDefaultTitle, noteTemplateHtml, type NoteTemplateId } from "@/lib/note-templates";
import {
  fetchGoogleDocsClientConfig,
  pickGoogleDocWithAccessToken,
} from "@/lib/google-docs-import-client";
import type { Note, Category, StudySetSummary } from "@/lib/api-types";
import { buildStudySetTitleFromNoteTitles } from "@/lib/study-set-utils";
import { NoteStudyProgressTrail } from "@/components/note-study-progress";
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
  FlipHorizontal,
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
  MoreVertical,
  Zap,
  Share2,
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

const STUDARA_SIDEBAR_CATEGORIES_COLLAPSED_KEY = "studara.sidebar.categoriesCollapsed";

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
            captureAnalytics("study_guide_generated", { category_id: categoryId });
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
  const [flashcardSessionRatings, setFlashcardSessionRatings] = React.useState<FlashcardRating[]>([]);
  const [flashcardRatingLoading, setFlashcardRatingLoading] = React.useState(false);
  const [studySetLoadError, setStudySetLoadError] = React.useState<string | null>(null);
  const [suggestBanner, setSuggestBanner] = React.useState<{ categoryId: string; name: string } | null>(null);
  const [newNoteIds, setNewNoteIds] = React.useState<Set<string>>(new Set());
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
  const [conceptMapModalTitle, setConceptMapModalTitle] = React.useState("");
  /** When non-null, the map is already stored in `study_sets` (hide “Save Concept Map”). */
  const [conceptMapSavedSetId, setConceptMapSavedSetId] = React.useState<string | null>(null);
  /** Opened from Study Sets / deep link — no in-editor note context for “Save as Note”. */
  const [conceptMapFromLibrary, setConceptMapFromLibrary] = React.useState(false);
  const [conceptMapLoading, setConceptMapLoading] = React.useState(false);
  const [conceptMapSaveNoteLoading, setConceptMapSaveNoteLoading] = React.useState(false);
  const [conceptMapSaveStudyLoading, setConceptMapSaveStudyLoading] = React.useState(false);
  const [titleLoading, setTitleLoading] = React.useState(false);
  /** Bumps when auto-generated title is applied — triggers a brief highlight on the title field. */
  const [titleAutoRevealTick, setTitleAutoRevealTick] = React.useState(0);
  const titleUserEditedRef = React.useRef(false);
  const autoTitleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tagsLoading, setTagsLoading] = React.useState(false);
  const [suggestTagsChips, setSuggestTagsChips] = React.useState<string[] | null>(null);
  const [toolbarError, setToolbarError] = React.useState<string | null>(null);
  const [improveToast, setImproveToast] = React.useState(false);
  const [shareNoteModalNoteId, setShareNoteModalNoteId] = React.useState<string | null>(null);
  /** Summary shown after Summarize from a grid card (no need to open the note first). */
  const [cardSummaryModal, setCardSummaryModal] = React.useState<{
    noteId: string;
    title: string;
    summary: string | null;
    error: string | null;
  } | null>(null);
  const [noteCardSummarizeLoadingId, setNoteCardSummarizeLoadingId] = React.useState<string | null>(null);
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
  const [sidebarCategoriesCollapsed, setSidebarCategoriesCollapsed] = React.useState(false);
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
      setFlashcardSessionRatings([]);
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

  React.useLayoutEffect(() => {
    try {
      if (localStorage.getItem(STUDARA_SIDEBAR_CATEGORIES_COLLAPSED_KEY) === "1") {
        setSidebarCategoriesCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebarCategoriesCollapsed = React.useCallback(() => {
    setSidebarCategoriesCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STUDARA_SIDEBAR_CATEGORIES_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

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
  /** Bumps when the title is replaced programmatically (e.g. AI) so the editor field resyncs without clobbering typing. */
  const [titleSyncKey, setTitleSyncKey] = React.useState(0);
  const [editContent, setEditContent] = React.useState("");
  /** Bumps when AI replaces full body so Tiptap remounts with new HTML. */
  const [editorContentRevision, setEditorContentRevision] = React.useState(0);
  /** Local “last saved” time for the open note (autosave + server `updated_at` on switch). */
  const [editorLastSavedAt, setEditorLastSavedAt] = React.useState<number | null>(null);
  /** While fetching full note from API after opening from the grid (avoids stale/wrong body flash). */
  const [noteOpenLoadingId, setNoteOpenLoadingId] = React.useState<string | null>(null);

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
      setConceptMapSavedSetId(null);
      setConceptMapFromLibrary(false);
      setConceptMapModalTitle((editTitleRef.current || "Untitled").trim() || "Untitled");
      setConceptMapGraph(json.graph);
      setConceptMapModalOpen(true);
      captureAnalytics("concept_map_generated", { note_id: selectedNote?.id });
    } catch {
      setToolbarError("Something went wrong. Try again.");
    } finally {
      setConceptMapLoading(false);
    }
  }, [plan, editContent, consumeStreakJson, setUpgradeModal, selectedNote?.id]);

  const saveConceptMapAsNote = React.useCallback(
    async (data: ConceptMapData) => {
      if (!selectedNote) return;
      setConceptMapSaveNoteLoading(true);
      setToolbarError(null);
      try {
        const sourceTitle = (editTitleRef.current || "Untitled").trim();
        const plain = conceptMapToNotePlainText(sourceTitle, data);
        const html = ensureEditorHtml(plain);
        const titleBase = sourceTitle.slice(0, 80);
        const title = `Concept map — ${titleBase || "Note"}`;
        const note = await actions.create(selectedNote.category_id ?? null, title);
        if (note) {
          await actions.update(note.id, { content: html });
          if (note.category_id) setSelectedCategoryId(note.category_id);
          setSelectedNoteId(note.id);
          const t = note.title;
          setEditTitle(t);
          editTitleRef.current = t;
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
    [selectedNote, actions, setSelectedCategoryId, setSelectedNoteId]
  );

  const saveConceptMapToStudySets = React.useCallback(
    async (data: ConceptMapData) => {
      const noteId = selectedNote?.id;
      if (!noteId || noteId.startsWith("draft-")) {
        setToolbarError("Open a saved note to save this concept map to Study sets.");
        return;
      }
      setConceptMapSaveStudyLoading(true);
      setToolbarError(null);
      try {
        const title = (editTitleRef.current || conceptMapModalTitle || "Untitled").trim() || "Concept map";
        const res = await fetch("/api/study-sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "concept_map",
            title,
            note_id: noteId,
            note_ids: [noteId],
            payload: { nodes: data.nodes, edges: data.edges },
          }),
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; error?: string; code?: string } | null;
        if (json?.code === "PRO_REQUIRED_STUDY" && res.status === 402) {
          setUpgradeModal({ show: true, feature: "study" });
          return;
        }
        if (!res.ok || !json?.ok || !json.id) {
          setToolbarError(json?.error ?? "Could not save concept map.");
          return;
        }
        setConceptMapSavedSetId(json.id);
        void refreshStudySets();
      } catch {
        setToolbarError("Could not save concept map.");
      } finally {
        setConceptMapSaveStudyLoading(false);
      }
    },
    [selectedNote?.id, conceptMapModalTitle, refreshStudySets, setUpgradeModal]
  );

  const editTitleRef = React.useRef(editTitle);
  const editContentRef = React.useRef(editContent);
  const skipSyncRef = React.useRef(false);
  const lastLoadedEditorNoteIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    editContentRef.current = editContent;
  }, [editContent]);

  React.useEffect(() => {
    setEditorContentRevision(0);
  }, [selectedNoteId]);

  React.useLayoutEffect(() => {
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
      // Same note: do not reset title/content from `selectedNote` — list refetches after autosave would fight the input.
      return;
    }
    lastLoadedEditorNoteIdRef.current = id;
    const nextTitle = selectedNote.title;
    const nextHtml = ensureEditorHtml(selectedNote.content);
    setEditTitle(nextTitle);
    editTitleRef.current = nextTitle;
    setTitleSyncKey((k) => k + 1);
    setEditContent(nextHtml);
    editContentRef.current = nextHtml;
  }, [selectedNoteId, selectedNote, draftNote]);

  React.useEffect(() => {
    if (!selectedNoteId) setNoteOpenLoadingId(null);
  }, [selectedNoteId]);

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
      const r = await fetch("/api/me/onboarding/complete", { method: "POST", credentials: "include" });
      if (r.ok) captureAnalytics("onboarding_completed", { flow: "skip_or_complete" });
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
    setFlashcardSessionRatings([]);
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
      const r = await fetch("/api/me/onboarding/complete", { method: "POST", credentials: "include" });
      if (r.ok) captureAnalytics("onboarding_completed", { flow: "dashboard_finish" });
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
      captureAnalytics("note_created", { source: "onboarding_sample", note_id: j.noteId });
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
        const deck = cards ?? [];
        primeFlashcardSession(deck);
        if (deck.length) captureAnalytics("flashcards_generated", { source: "onboarding" });
        setStudyMode("flashcards");
        void refreshStudySets();
      } catch {
        const p = guidedOnboardingRef.current?.persona;
        if (p) {
          const demo = getOnboardingDemoFlashcards(p);
          primeFlashcardSession(demo);
          if (demo.length) captureAnalytics("flashcards_generated", { source: "onboarding_fallback" });
        }
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
      setFlashcardSessionRatings([]);
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
      setFlashcardSessionRatings([]);
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
    if (draftNote && nid === draftNote.id)
      return ((editTitleRef.current || editTitle || "Untitled").trim() || "Untitled");
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

  React.useEffect(() => {
    if (!selectedNoteId || selectedNoteId.startsWith("draft-")) return;
    captureAnalytics("note_opened", { note_id: selectedNoteId });
  }, [selectedNoteId]);

  React.useEffect(() => {
    if (!selectedNoteId || selectedNoteId.startsWith("draft-")) {
      setEditorLastSavedAt(null);
      return;
    }
    const n = notes.find((x) => x.id === selectedNoteId);
    if (n?.updated_at) setEditorLastSavedAt(new Date(n.updated_at).getTime());
  }, [selectedNoteId, notes]);

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
        title: editTitleRef.current,
        content: editContentRef.current,
      };
    } else {
      editorFlushRef.current = { id: null, title: "", content: "" };
    }
  }, [selectedNoteId, editTitle, editContent, draftNote, selectedNote]);

  const selectedNoteIdRef = React.useRef(selectedNoteId);
  selectedNoteIdRef.current = selectedNoteId;

  React.useEffect(() => {
    titleUserEditedRef.current = false;
  }, [selectedNoteId]);

  const openNoteFromList = React.useCallback(
    (note: Note) => {
      if (note.id.startsWith("draft-")) return;
      const snapshotHtml = ensureEditorHtml(note.content ?? "");
      const snapshotTitle = note.title ?? "";
      lastLoadedEditorNoteIdRef.current = note.id;
      editTitleRef.current = snapshotTitle;
      editContentRef.current = snapshotHtml;
      setEditTitle(snapshotTitle);
      setTitleSyncKey((k) => k + 1);
      setEditContent(snapshotHtml);
      setSelectedNoteId(note.id);
      setMobileSidebarOpen(false);
      setNoteOpenLoadingId(note.id);
      const id = note.id;
      void (async () => {
        try {
          const fresh = await actions.fetchNoteById(id);
          if (selectedNoteIdRef.current !== id) return;
          if (fresh) {
            const nextHtml = ensureEditorHtml(fresh.content ?? "");
            if (editContentRef.current === snapshotHtml) {
              editContentRef.current = nextHtml;
              setEditContent(nextHtml);
            }
            if (editTitleRef.current === snapshotTitle) {
              const t = fresh.title ?? "";
              editTitleRef.current = t;
              setEditTitle(t);
              setTitleSyncKey((k) => k + 1);
            }
          }
        } finally {
          if (selectedNoteIdRef.current === id) setNoteOpenLoadingId(null);
        }
      })();
    },
    [actions]
  );

  const handleSummarizeFromNoteCard = React.useCallback(
    async (note: Note) => {
      if (note.id.startsWith("draft-")) return;
      const plain = htmlToPlainText(note.content || "").trim();
      if (!plain) {
        setCardSummaryModal({
          noteId: note.id,
          title: note.title || "Untitled",
          summary: null,
          error: "Add some note content before summarizing.",
        });
        return;
      }
      captureAnalytics("summarize_clicked", { context: "note_card", note_id: note.id });
      setNoteCardSummarizeLoadingId(note.id);
      try {
        const res = await fetch("/api/ai/anthropic/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: plain }),
        });
        const json = (await res.json()) as { summary?: string; code?: string; error?: string };
        if (json.code && res.status === 402) {
          setUpgradeModal({ show: true, message: json.error ?? "Upgrade to Pro" });
          return;
        }
        if (json.summary) {
          consumeStreakJson(json);
          void loadUserStats();
          void actions.update(note.id, { record_summarization: true });
          setCardSummaryModal({
            noteId: note.id,
            title: note.title || "Untitled",
            summary: json.summary,
            error: null,
          });
        } else if (json.error) {
          setCardSummaryModal({
            noteId: note.id,
            title: note.title || "Untitled",
            summary: null,
            error: json.error,
          });
        } else {
          setCardSummaryModal({
            noteId: note.id,
            title: note.title || "Untitled",
            summary: null,
            error: "Could not summarize this note.",
          });
        }
      } catch {
        setCardSummaryModal({
          noteId: note.id,
          title: note.title || "Untitled",
          summary: null,
          error: "Something went wrong. Try again.",
        });
      } finally {
        setNoteCardSummarizeLoadingId((cur) => (cur === note.id ? null : cur));
      }
    },
    [actions, consumeStreakJson, loadUserStats]
  );

  const handleStudyFromNoteCard = React.useCallback(
    (noteId: string) => {
      if (noteId.startsWith("draft-")) return;
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
      setStudyModal({ kind: "single", noteId });
      setStudyMode("menu");
    },
    [onboardingGate, guidedOnboarding, plan]
  );

  const selectedNoteRef = React.useRef(selectedNote);
  selectedNoteRef.current = selectedNote;
  const draftNoteRef = React.useRef(draftNote);
  draftNoteRef.current = draftNote;
  const newNoteIdsRef = React.useRef(newNoteIds);
  newNoteIdsRef.current = newNoteIds;
  const suggestBannerRef = React.useRef(suggestBanner);
  suggestBannerRef.current = suggestBanner;
  const planRef = React.useRef(plan);
  planRef.current = plan;
  const categoriesRef = React.useRef(categories);
  categoriesRef.current = categories;

  const saveDebounce = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleUiDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueNoteAutosave = React.useCallback(() => {
    const nid = selectedNoteIdRef.current;
    if (!nid || draftNoteRef.current || selectedNoteRef.current == null || nid.startsWith("draft-")) return;

    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      const idNow = selectedNoteIdRef.current;
      if (!idNow || draftNoteRef.current || idNow.startsWith("draft-")) return;

      const title = editTitleRef.current;
      const content = editContentRef.current;
      void actionsRef.current.update(idNow, { title, content });
      setEditorLastSavedAt(Date.now());

      const plain = htmlToPlainText(content).trim();
      const nids = newNoteIdsRef.current;
      const pl = planRef.current;
      const banner = suggestBannerRef.current;
      const cats = categoriesRef.current;

      if (nids.has(idNow) && plain.length > 50 && pl === "pro") {
        const catIds = cats.map((c) => c.id);
        const catNames = cats.map((c) => c.name);
        fetch("/api/ai/anthropic/suggest-category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: plain,
            categoryIds: catIds,
            categoryNames: catNames,
          }),
        })
          .then((r) => r.json())
          .then((j: { category?: { id: string; name: string } }) => {
            if (j.category && !suggestBannerRef.current) {
              setSuggestBanner({ categoryId: j.category.id, name: j.category.name });
            }
          })
          .catch(() => {});
        setNewNoteIds((prev) => {
          const next = new Set(prev);
          next.delete(idNow);
          return next;
        });
      }
    }, 500);
  }, []);

  const onTitleDraftChange = React.useCallback((v: string) => {
    titleUserEditedRef.current = true;
    if (autoTitleTimerRef.current) {
      clearTimeout(autoTitleTimerRef.current);
      autoTitleTimerRef.current = null;
    }
    editTitleRef.current = v;
    if (draftNoteRef.current && selectedNoteIdRef.current === draftNoteRef.current.id) {
      setDraftNote((d) => (d ? { ...d, title: v } : null));
    }

    if (selectedNoteIdRef.current && !draftNoteRef.current && selectedNoteRef.current && !selectedNoteIdRef.current.startsWith("draft-")) {
      editorFlushRef.current = {
        id: selectedNoteIdRef.current,
        title: v,
        content: editContentRef.current,
      };
    }

    if (titleUiDebounceRef.current) clearTimeout(titleUiDebounceRef.current);
    titleUiDebounceRef.current = setTimeout(() => {
      setEditTitle(v);
      titleUiDebounceRef.current = null;
    }, 500);

    queueNoteAutosave();
  }, [queueNoteAutosave]);

  const runAutoTitleForNote = React.useCallback(
    async (noteIdAtSchedule: string) => {
      if (titleUserEditedRef.current) return;
      if (selectedNoteIdRef.current !== noteIdAtSchedule) return;
      const titleNow = (editTitleRef.current || "").trim();
      if (titleNow !== "" && !/^untitled$/i.test(titleNow)) return;
      const plain = htmlToPlainText(editContentRef.current).trim();
      const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
      if (words < 50) return;

      setTitleLoading(true);
      setToolbarError(null);
      try {
        const res = await fetch("/api/ai/anthropic/generate-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: plain.slice(0, 8000) }),
        });
        const json = (await res.json()) as { title?: string; error?: string };
        if (titleUserEditedRef.current) return;
        if (selectedNoteIdRef.current !== noteIdAtSchedule) return;
        const t2 = (editTitleRef.current || "").trim();
        if (t2 !== "" && !/^untitled$/i.test(t2)) return;
        if (!json.title) return;
        const title = sanitizeGeneratedNoteTitle(json.title);
        if (!title || /^untitled$/i.test(title)) return;

        consumeStreakJson(json);
        setEditTitle(title);
        editTitleRef.current = title;
        setTitleSyncKey((k) => k + 1);
        setTitleAutoRevealTick((x) => x + 1);

        if (noteIdAtSchedule.startsWith("draft-")) {
          setDraftNote((d) => (d && d.id === noteIdAtSchedule ? { ...d, title } : d));
        } else {
          void actionsRef.current.update(noteIdAtSchedule, { title });
        }
        void loadUserStats();
      } catch {
        /* auto-title failures stay quiet */
      } finally {
        setTitleLoading(false);
      }
    },
    [consumeStreakJson, loadUserStats]
  );

  React.useEffect(() => {
    if (autoTitleTimerRef.current) {
      clearTimeout(autoTitleTimerRef.current);
      autoTitleTimerRef.current = null;
    }
    if (!selectedNoteId) return;
    if (!selectedNoteId.startsWith("draft-") && noteOpenLoadingId === selectedNoteId) return;

    const titleTrim = (editTitle || "").trim();
    const isPlaceholder = titleTrim === "" || /^untitled$/i.test(titleTrim);
    const plain = htmlToPlainText(editContent).trim();
    const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    if (!isPlaceholder || titleUserEditedRef.current || words < 50) return;

    const noteIdAtSchedule = selectedNoteId;
    autoTitleTimerRef.current = setTimeout(() => {
      autoTitleTimerRef.current = null;
      void runAutoTitleForNote(noteIdAtSchedule);
    }, 30_000);

    return () => {
      if (autoTitleTimerRef.current) {
        clearTimeout(autoTitleTimerRef.current);
        autoTitleTimerRef.current = null;
      }
    };
  }, [selectedNoteId, editContent, editTitle, noteOpenLoadingId, runAutoTitleForNote]);

  React.useEffect(() => {
    return () => {
      if (titleUiDebounceRef.current) clearTimeout(titleUiDebounceRef.current);
    };
  }, []);

  React.useEffect(() => {
    queueNoteAutosave();
    return () => {
      if (saveDebounce.current) clearTimeout(saveDebounce.current);
    };
  }, [editContent, queueNoteAutosave]);

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
      editTitleRef.current = title;
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
    editTitleRef.current = note.title;
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
      const slideTitle = json.title ?? "Untitled";
      setEditTitle(slideTitle);
      editTitleRef.current = slideTitle;
      setEditContent(ensureEditorHtml(json.content ?? ""));
      setDraftNote(null);
      setSelectedCategoryId(json.category_id ?? "all");
      setStudyModal(null);
      exitGridSelection();
      setNewNoteIds((prev) => new Set(prev).add(json.id));
      captureAnalytics("note_created", { source: "analyze_slides", note_id: json.id });
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
      const gdocTitle = json.title ?? "Untitled";
      setEditTitle(gdocTitle);
      editTitleRef.current = gdocTitle;
      setEditContent(ensureEditorHtml(json.content ?? ""));
      setDraftNote(null);
      setSelectedCategoryId(json.category_id ?? "all");
      setStudyModal(null);
      exitGridSelection();
      setNewNoteIds((prev) => new Set(prev).add(json.id));
      captureAnalytics("note_created", { source: "import_google_doc", note_id: json.id });
      setMobileSidebarOpen(false);
    } catch {
      setImportDocError("Something went wrong while importing. Try again.");
    } finally {
      setImportGoogleDocSaving(false);
    }
  }

  const handleVoiceTranscriptionSuccess = React.useCallback(
    async (json: VoiceTranscriptionSuccessPayload) => {
      console.log("[note-app] voice transcription success payload", {
        draft_append: json.draft_append,
        appended: json.appended,
        id: json.id,
        title: json.title,
        category_id: json.category_id,
        contentLength: typeof json.content === "string" ? json.content.length : 0,
      });
      captureAnalytics("voice_transcription_used", {
        draft_append: json.draft_append === true,
        appended: json.appended === true,
      });
      consumeStreakJson(json);
      setVoiceNotesError(null);
      setToolbarError(null);

      if (json.draft_append === true) {
        const chunk = ensureEditorHtml(json.content ?? "");
        const mergeWithDivider = (baseRaw: string) => {
          const base = ensureEditorHtml(baseRaw);
          const hasBody = htmlToPlainText(base).trim().length > 0;
          return hasBody ? `${base}<hr />${chunk}` : chunk;
        };
        setEditContent((prev) => mergeWithDivider(prev));
        setDraftNote((d) => (d ? { ...d, content: mergeWithDivider(d.content ?? "") } : null));
        setEditorContentRevision((r) => r + 1);
        setMobileSidebarOpen(false);
        try {
          await actions.refresh();
        } catch (e) {
          console.error("[note-app] refresh after voice draft append failed", e);
        }
        void loadUserStats();
        return;
      }

      if (json.appended === true && typeof json.id === "string") {
        lastLoadedEditorNoteIdRef.current = json.id;
        setSelectedNoteId(json.id);
        const voiceTitleA = json.title ?? "Untitled";
        setEditTitle(voiceTitleA);
        editTitleRef.current = voiceTitleA;
        setTitleSyncKey((k) => k + 1);
        setEditContent(ensureEditorHtml(json.content ?? ""));
        setEditorContentRevision((r) => r + 1);
        setDraftNote(null);
        setStudyModal(null);
        setGridSelectMode(false);
        setGridSelectedIds(new Set());
        setMultiStudyError(null);
        setMobileSidebarOpen(false);
        try {
          await actions.refresh();
        } catch (e) {
          console.error("[note-app] refresh after voice append failed (editor already updated)", e);
        }
        void loadUserStats();
        return;
      }

      if (typeof json.id !== "string") return;

      captureAnalytics("note_created", { source: "voice", note_id: json.id });
      lastLoadedEditorNoteIdRef.current = null;
      setSelectedNoteId(json.id);
      const voiceTitleB = json.title ?? "Untitled";
      setEditTitle(voiceTitleB);
      editTitleRef.current = voiceTitleB;
      setEditContent(ensureEditorHtml(json.content ?? ""));
      setDraftNote(null);
      setSelectedCategoryId(json.category_id ?? "all");
      setStudyModal(null);
      setGridSelectMode(false);
      setGridSelectedIds(new Set());
      setMultiStudyError(null);
      setNewNoteIds((prev) => new Set(prev).add(json.id));
      setMobileSidebarOpen(false);
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
        if (studyModal?.kind === "single" && studyModal.noteId === id) setStudyModal(null);
        if (studyModal?.kind === "multi" && studyModal.noteIds.includes(id)) setStudyModal(null);
        setDeleteNoteModal(null);
        return;
      }
      const ok = await actions.delete(id);
      if (!ok) return;
      setSelectedNoteId(null);
      setDraftNote(null);
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
        const cards = json.cards ?? [];
        if (cards.length) captureAnalytics("flashcards_generated", { source: "multi", note_count: ids.length });
        primeFlashcardSession(cards);
        setStudyMode("flashcards");
      } else {
        const questions = json.questions ?? [];
        if (questions.length) captureAnalytics("quiz_generated", { source: "multi", note_count: ids.length });
        setQuizQuestions(questions);
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
        kind?: "flashcards" | "quiz" | "concept_map";
        title?: string;
        payload?: unknown;
      } | null;
      if (!res.ok) {
        const msg = data && typeof data.error === "string" ? data.error : "Could not open study set";
        setStudySetLoadError(msg);
        return;
      }
      if (!data || (data.kind !== "flashcards" && data.kind !== "quiz" && data.kind !== "concept_map")) {
        setStudySetLoadError("Invalid study set data");
        return;
      }
      if (data.kind === "concept_map") {
        const graph = parseConceptMapPayload(data.payload);
        if (!graph) {
          setStudySetLoadError("Invalid concept map data");
          return;
        }
        setConceptMapSavedSetId(setId);
        setConceptMapFromLibrary(true);
        setConceptMapModalTitle((data.title ?? titleFallback ?? "Concept map").trim() || "Concept map");
        setConceptMapGraph(graph);
        setConceptMapModalOpen(true);
        return;
      }
      if (data.kind === "flashcards") {
        primeFlashcardSession(
          (data.payload as { cards?: { front: string; back: string }[] })?.cards ?? []
        );
        setStudyMode("flashcards");
      } else {
        setQuizQuestions(
          (data.payload as {
            questions?: { question: string; options: string[]; correctIndex: number }[];
          })?.questions ?? []
        );
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

    setFlashcardSessionRatings((prev) => [...prev, rating]);
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
    !conceptMapModalOpen &&
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
        <p className="max-w-sm text-sm text-[var(--status-danger-fg)]">{studySetLoadError}</p>
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
              "absolute z-[80] min-w-[15rem] rounded-xl border border-[var(--border)] bg-[var(--surface-mid)] py-1 shadow-[var(--shadow-brand-lg)]",
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
          <div className="max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--modal-surface)] px-8 py-6 text-center shadow-[var(--shadow-brand-lg)]">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-[var(--accent)]" aria-hidden />
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
          mobileSidebarOpen ? "translate-x-0 shadow-[var(--shadow-brand-lg)]" : "-translate-x-full md:translate-x-0"
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
            className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/85 to-blue-500/85 px-4 py-3 text-sm font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] transition duration-200 hover:from-purple-500 hover:to-blue-500"
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
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--text)] shadow-inner outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-[var(--accent)]/40 focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>
        </div>
        <nav className="app-sidebar-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-6">
          {importDocError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5 text-xs text-[var(--status-danger-fg)]">
              <span>{importDocError}</span>
              <button
                type="button"
                onClick={() => setImportDocError(null)}
                className="shrink-0 text-[var(--status-danger-fg-strong)] transition hover:text-[var(--text)]"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {slidesAnalyzeError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5 text-xs text-[var(--status-danger-fg)]">
              <span>{slidesAnalyzeError}</span>
              <button
                type="button"
                onClick={() => setSlidesAnalyzeError(null)}
                className="shrink-0 text-[var(--status-danger-fg-strong)] transition hover:text-[var(--text)]"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {voiceNotesError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5 text-xs text-[var(--status-danger-fg)]">
              <span>{voiceNotesError}</span>
              <button
                type="button"
                onClick={() => setVoiceNotesError(null)}
                className="shrink-0 text-[var(--status-danger-fg-strong)] transition hover:text-[var(--text)]"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {categoryError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5 text-xs text-[var(--status-danger-fg)]">
              <span>{categoryError}</span>
              <button
                type="button"
                onClick={clearCategoryError}
                className="shrink-0 text-[var(--status-danger-fg-strong)] transition hover:text-[var(--text)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="px-1">
            <button
              type="button"
              onClick={toggleSidebarCategoriesCollapsed}
              aria-expanded={!sidebarCategoriesCollapsed}
              aria-controls="sidebar-categories-panel"
              className="mb-2.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 hover:bg-[var(--hover-bg-subtle)] touch-manipulation"
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform duration-300 ease-out",
                  !sidebarCategoriesCollapsed && "rotate-90"
                )}
                strokeWidth={2.25}
                aria-hidden
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
                Categories
              </span>
            </button>
            <div className="space-y-1">
              <CategoryTab
                id="all"
                name="All Notes"
                count={noteCounts.total}
                icon={<LayoutGrid className="h-4 w-4 shrink-0 text-[var(--muted)]" />}
                selected={selectedCategoryId === "all"}
                onClick={() => selectSidebarCategory("all")}
              />
              <div
                id="sidebar-categories-panel"
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  sidebarCategoriesCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-1 pb-0.5">
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
                      <FolderPlus className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                      Add category
                    </button>
                  </div>
                </div>
              </div>
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
                <GraduationCap className="h-4 w-4 shrink-0 text-[var(--accent-icon)]" />
                AI Tutor
              </Link>
              <Link
                href="/essay-feedback"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] touch-manipulation"
              >
                <FilePenLine className="h-4 w-4 shrink-0 text-[var(--accent-icon)]" />
                Essay Feedback
              </Link>
              <Link
                href="/citations"
                onClick={() => setMobileSidebarOpen(false)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)] touch-manipulation"
              >
                <Quote className="h-4 w-4 shrink-0 text-[var(--accent-icon)]" strokeWidth={2} />
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
              onClick={() => {
                captureAnalytics("pro_upgrade_clicked", { placement: "sidebar" });
                setMobileSidebarOpen(false);
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 py-2.5 text-sm font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] transition duration-200 hover:from-purple-500 hover:to-blue-500 touch-manipulation"
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
                  <span className="inline-flex rounded-md border border-[var(--pro-badge-border)] bg-[var(--pro-badge-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--pro-badge-fg)]">
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
            className="shrink-0 border-b border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-2.5 text-center text-sm text-[var(--status-warning-fg)]"
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
            className="flex shrink-0 flex-col gap-2 border-b border-[var(--accent-nudge-border)] bg-[var(--accent-nudge-bg)] px-4 py-3 text-sm text-[var(--accent-nudge-fg)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
              className="shrink-0 rounded-lg border border-[var(--accent-nudge-border)] bg-[var(--accent-nudge-bg)] px-3 py-2 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
            >
              Open {userStats.recent_study_set_title ? `“${userStats.recent_study_set_title.slice(0, 32)}${userStats.recent_study_set_title.length > 32 ? "…" : ""}”` : "latest set"}
            </button>
          </div>
        ) : null}
        {studySetLoadError ? (
          <div
            role="alert"
            className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-fg)]"
          >
            <span className="min-w-0">{studySetLoadError}</span>
            <button
              type="button"
              onClick={() => setStudySetLoadError(null)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[var(--status-danger-fg)] transition hover:bg-[var(--status-danger-bg-elevated)] hover:text-[var(--text)]"
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
            titleSyncKey={titleSyncKey}
            onTitleDraftChange={onTitleDraftChange}
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
              captureAnalytics("improve_clicked", {});
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
            titleAutoRevealTick={titleAutoRevealTick}
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
              captureAnalytics("summarize_clicked", { context: "editor" });
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
              const title = (editTitleRef.current || editTitle || "Untitled").trim() || "note";
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
              const title = (editTitleRef.current || editTitle || "Untitled").trim() || "note";
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
            onShareNote={
              selectedNote && !selectedNote.id.startsWith("draft-")
                ? () => setShareNoteModalNoteId(selectedNote.id)
                : undefined
            }
            lastSavedAt={editorLastSavedAt}
            isDraftNote={!!draftNote && draftNote.id === selectedNote.id}
            voiceToNotesToolbar={
              <VoiceToNotesControl
                layout="editor"
                plan={plan}
                categoryId={selectedNote!.category_id ?? null}
                appendNoteId={
                  selectedNote!.id.startsWith("draft-") ? null : selectedNote!.id
                }
                draftVoiceAppend={selectedNote!.id.startsWith("draft-")}
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
            noteContentLoading={
              !!selectedNoteId &&
              !selectedNoteId.startsWith("draft-") &&
              noteOpenLoadingId === selectedNoteId
            }
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
                    className="gap-1.5 border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] hover:from-violet-500 hover:to-indigo-500"
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
              <div
                role="status"
                aria-label="Activity summary"
                className="mb-3 flex h-11 min-h-[44px] max-h-12 w-full min-w-0 items-center rounded-2xl border border-[var(--border)] bg-[var(--chrome-40)] px-0 shadow-sm backdrop-blur-xl transition-colors duration-200"
              >
                <div className="studara-dashboard-stats-bar-scroll flex min-h-0 min-w-0 flex-1 items-center gap-0 overflow-x-auto whitespace-nowrap px-1 sm:px-2">
                  <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-0 sm:px-3">
                    <span className="select-none text-[15px] leading-none" aria-hidden>
                      🔥
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--accent)]">{userStats.current_streak}</span>
                    <span className="text-xs font-medium text-[var(--muted)]">Streak</span>
                  </div>
                  <div className="h-5 w-px shrink-0 bg-[var(--border)] opacity-60" aria-hidden />
                  <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-0 sm:px-3">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--faint)]" strokeWidth={2} aria-hidden />
                    <span className="text-sm font-semibold tabular-nums text-[var(--text)]">{userStats.total_notes}</span>
                    <span className="text-xs font-medium text-[var(--muted)]">Notes</span>
                  </div>
                  <div className="h-5 w-px shrink-0 bg-[var(--border)] opacity-60" aria-hidden />
                  <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-0 sm:px-3">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" strokeWidth={2} aria-hidden />
                    <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
                      {userStats.summarizations_this_month}
                    </span>
                    <span className="text-xs font-medium text-[var(--muted)]">Summaries</span>
                  </div>
                  <div className="h-5 w-px shrink-0 bg-[var(--border)] opacity-60" aria-hidden />
                  <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-0 sm:px-3">
                    <Layers className="h-3.5 w-3.5 shrink-0 text-[var(--accent-icon)]" strokeWidth={2} aria-hidden />
                    <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
                      {userStats.flashcard_sets_studied_this_week}
                    </span>
                    <span className="text-xs font-medium text-[var(--muted)]">Flashcards</span>
                  </div>
                  <div className="h-5 w-px shrink-0 bg-[var(--border)] opacity-60" aria-hidden />
                  <div className="flex shrink-0 items-center gap-1.5 px-2.5 py-0 pr-3 sm:pr-4">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0 text-[var(--accent2)]" strokeWidth={2} aria-hidden />
                    <span className="text-sm font-semibold tabular-nums text-[var(--text)]">{userStats.quizzes_this_week}</span>
                    <span className="text-xs font-medium text-[var(--muted)]">Quizzes</span>
                  </div>
                </div>
              </div>
            ) : null}
            {multiStudyError && (
              <p className="mb-3 text-sm text-[var(--status-danger-fg-strong)]">{multiStudyError}</p>
            )}
            {notesLoadError ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-12 text-center">
                <p className="max-w-md text-sm text-[var(--status-danger-fg)]">{notesLoadError}</p>
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
              <div className="flex min-h-0 flex-1 justify-center overflow-y-auto overflow-x-hidden px-1 pb-2">
                <div className="grid w-full max-w-[1600px] content-start justify-center gap-4 [grid-template-columns:repeat(auto-fill,280px)]">
                  {filteredNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      categories={categories}
                      selectMode={gridSelectMode}
                      selected={gridSelectedIds.has(note.id)}
                      onToggleSelect={() => toggleGridNoteSelected(note.id)}
                      onSelect={() => openNoteFromList(note)}
                      onRequestDelete={() =>
                        setDeleteNoteModal({ id: note.id, title: note.title || "Untitled" })
                      }
                      onShare={() => setShareNoteModalNoteId(note.id)}
                      onSummarizeFromCard={() => void handleSummarizeFromNoteCard(note)}
                      onStudyFromCard={() => handleStudyFromNoteCard(note.id)}
                      summarizeLoading={noteCardSummarizeLoadingId === note.id}
                    />
                  ))}
                </div>
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
            setFlashcardSessionRatings([]);
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
                captureAnalytics("flashcards_generated", { source: "single", mode: "cached", note_id: nid });
                primeFlashcardSession(cards);
                setStudyMode("flashcards");
              } else {
                const body: { kind: "flashcards"; content?: string; title?: string } = { kind: "flashcards" };
                if (draftNote && nid === draftNote.id) {
                  body.content = htmlToPlainText(editContent);
                  body.title = editTitleRef.current || editTitle;
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
                const genCards = j.cards ?? [];
                if (genCards.length) captureAnalytics("flashcards_generated", { source: "single", mode: "generated", note_id: nid });
                primeFlashcardSession(genCards);
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
                captureAnalytics("quiz_generated", { source: "single", mode: "cached", note_id: nid });
                setQuizQuestions(qs);
                setStudyMode("quiz");
              } else {
                const body: { kind: "quiz"; content?: string; title?: string } = { kind: "quiz" };
                if (draftNote && nid === draftNote.id) {
                  body.content = htmlToPlainText(editContent);
                  body.title = editTitleRef.current || editTitle;
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
                const genQs = j.questions ?? [];
                if (genQs.length) captureAnalytics("quiz_generated", { source: "single", mode: "generated", note_id: nid });
                setQuizQuestions(genQs);
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
          flashcardSessionRatings={flashcardSessionRatings}
          flashcardRatingLoading={flashcardRatingLoading}
          onFlashcardRate={(r) => void handleFlashcardRate(r)}
          onFlashcardsStudyAgain={() => {
            primeFlashcardSession(flashcards, {
              originalIndices: flashcardOriginalIndices,
              reviewDueTotal: flashcardReviewDueTotal,
            });
          }}
          onFlashcardsStudyMissedOnly={() => {
            const missedCards: { front: string; back: string }[] = [];
            const missedOrig: number[] = [];
            flashcardSessionRatings.forEach((r, i) => {
              if (r === "hard") {
                const c = flashcards[i];
                if (c) {
                  missedCards.push(c);
                  missedOrig.push(flashcardOriginalIndices[i] ?? i);
                }
              }
            });
            if (missedCards.length === 0) return;
            primeFlashcardSession(missedCards, {
              originalIndices: missedOrig,
              reviewDueTotal: null,
            });
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

      {studyGuideModal ? (
        <div
          className="fixed inset-0 z-[55] flex flex-col bg-[var(--bg)]"
          role="dialog"
          aria-modal
          aria-labelledby="study-guide-title"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--chrome-40)] px-4 py-3 backdrop-blur-xl sm:px-6">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-label)]">Study guide</p>
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
                <Loader2 className="h-10 w-10 animate-spin text-[var(--accent)]" />
                <p className="text-sm text-[var(--muted)]">Generating your study guide…</p>
              </div>
            ) : studyGuideError ? (
              <div className="mx-auto max-w-md rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-6 text-center">
                <p className="text-sm text-[var(--status-danger-fg)]">{studyGuideError}</p>
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
                onClick={() => {
                  captureAnalytics("pro_upgrade_clicked", { placement: "upgrade_modal" });
                  setUpgradeModal({ show: false });
                }}
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

      {cardSummaryModal ? (
        <div
          role="dialog"
          aria-modal
          aria-labelledby="card-summary-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay-scrim)] p-4 backdrop-blur-sm"
          onClick={() => setCardSummaryModal(null)}
        >
          <div
            className="max-h-[min(72dvh,34rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--modal-surface)] p-5 shadow-[var(--shadow-brand-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="card-summary-title" className="text-lg font-semibold text-[var(--text)]">
              {cardSummaryModal.title}
            </h2>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Summary</p>
            {cardSummaryModal.error ? (
              <p className="mt-3 text-sm text-[var(--status-danger-fg-strong)]">{cardSummaryModal.error}</p>
            ) : cardSummaryModal.summary ? (
              <div className="mt-3 text-sm leading-relaxed text-[var(--text)]">
                <TutorMarkdown content={cardSummaryModal.summary} className={summaryMarkdownLayoutClassName} />
              </div>
            ) : null}
            <div className="mt-5 flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setCardSummaryModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConceptMapModal
        open={conceptMapModalOpen}
        onClose={() => {
          setConceptMapModalOpen(false);
          setConceptMapGraph(null);
          setConceptMapSavedSetId(null);
          setConceptMapFromLibrary(false);
        }}
        graph={conceptMapGraph}
        sourceTitle={
          conceptMapModalTitle.trim() ||
          (editTitleRef.current || editTitle || "Untitled").trim() ||
          "Untitled"
        }
        onSaveAsNote={saveConceptMapAsNote}
        saveNoteLoading={conceptMapSaveNoteLoading}
        showSaveAsNote={
          !!selectedNote && !selectedNote.id.startsWith("draft-") && !conceptMapFromLibrary
        }
        onSaveToStudySets={saveConceptMapToStudySets}
        saveStudySetsLoading={conceptMapSaveStudyLoading}
        showSaveToStudySets={!conceptMapSavedSetId}
      />

      {saveErrorMessage ? (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 flex max-w-[min(100vw-2rem,24rem)] -translate-x-1/2 items-start gap-3 rounded-lg border border-[var(--status-danger-border)] bg-[var(--modal-surface)] px-4 py-3 text-sm text-[var(--status-danger-fg)] shadow-[var(--shadow-brand-lg)] backdrop-blur-xl"
        >
          <span className="min-w-0 flex-1 leading-snug">{saveErrorMessage}</span>
          <button
            type="button"
            onClick={() => clearSaveErrorMessage()}
            className="shrink-0 rounded-md p-1 text-[var(--status-danger-fg-strong)] transition hover:bg-[var(--status-danger-bg-elevated)] hover:text-[var(--text)]"
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
  titleSyncKey,
  onTitleDraftChange,
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
  titleAutoRevealTick,
  tagsLoading,
  suggestTagsChips,
  toolbarError,
  onBack,
  onUpdate,
  onSuggestApply,
  onSuggestDismiss,
  onImprove,
  improveButtonRef,
  onSuggestTags,
  onStudy,
  onClaudeSummarize,
  onAutoCategorize,
  onExportPdf,
  onExportMd,
  onSuggestTagAccept,
  onSuggestTagDismiss,
  onToolbarErrorDismiss,
  onShareNote,
  lastSavedAt,
  isDraftNote,
  voiceToNotesToolbar,
  studyProgressCompletion,
  noteContentLoading,
  onDeleteRequest,
}: {
  selectedNote: Note;
  categories: Category[];
  richEditorKey: string;
  onOpenMobileMenu?: () => void;
  editTitle: string;
  titleSyncKey: number;
  onTitleDraftChange: (v: string) => void;
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
  titleAutoRevealTick: number;
  tagsLoading: boolean;
  suggestTagsChips: string[] | null;
  toolbarError: string | null;
  onBack: () => void;
  onUpdate: (patch: Partial<Pick<Note, "title" | "content" | "category_id" | "tags">>) => void;
  onSuggestApply: () => void;
  onSuggestDismiss: () => void;
  onImprove: () => void;
  improveButtonRef?: React.RefObject<HTMLElement | null>;
  onSuggestTags: () => void;
  onStudy: () => void;
  onClaudeSummarize: () => void;
  onAutoCategorize: () => void;
  onExportPdf: () => void | Promise<void>;
  onExportMd: () => void;
  onSuggestTagAccept: (tag: string) => void;
  onSuggestTagDismiss: () => void;
  onToolbarErrorDismiss: () => void;
  onShareNote?: () => void;
  lastSavedAt: number | null;
  isDraftNote: boolean;
  voiceToNotesToolbar?: React.ReactNode;
  studyProgressCompletion: StudyProgressCompletion;
  noteContentLoading?: boolean;
  onDeleteRequest: () => void;
}) {
  const [localTitle, setLocalTitle] = React.useState(editTitle);
  const titleSyncGuardRef = React.useRef({ id: selectedNote.id, key: titleSyncKey });
  React.useLayoutEffect(() => {
    const prev = titleSyncGuardRef.current;
    const idChanged = prev.id !== selectedNote.id;
    const keyChanged = prev.key !== titleSyncKey;
    titleSyncGuardRef.current = { id: selectedNote.id, key: titleSyncKey };
    if (idChanged || keyChanged) {
      setLocalTitle(editTitle);
    }
  }, [selectedNote.id, titleSyncKey, editTitle]);

  const [titleRevealActive, setTitleRevealActive] = React.useState(false);
  React.useEffect(() => {
    if (titleAutoRevealTick === 0) return;
    setTitleRevealActive(true);
    const t = window.setTimeout(() => setTitleRevealActive(false), 1300);
    return () => window.clearTimeout(t);
  }, [titleAutoRevealTick]);

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

  const [categoryMenuOpen, setCategoryMenuOpen] = React.useState(false);
  const [editorMenuOpen, setEditorMenuOpen] = React.useState(false);
  const categoryMenuRef = React.useRef<HTMLDivElement>(null);
  const editorMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!categoryMenuOpen && !editorMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (categoryMenuOpen && categoryMenuRef.current?.contains(t)) return;
      if (editorMenuOpen && editorMenuRef.current?.contains(t)) return;
      setCategoryMenuOpen(false);
      setEditorMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [categoryMenuOpen, editorMenuOpen]);

  const categoryLabel = React.useMemo(() => {
    if (selectedNote.category_id === "pending" && !categories.some((c) => c.id === "pending")) {
      return "General (creating…)";
    }
    if (!selectedNote.category_id) return "Uncategorized";
    const c = categories.find((x) => x.id === selectedNote.category_id);
    return c?.name ?? "Uncategorized";
  }, [selectedNote.category_id, categories]);

  const categoryDotColor =
    selectedNote.category_id && selectedNote.category_id !== "pending"
      ? categories.find((c) => c.id === selectedNote.category_id)?.color
      : undefined;

  const plainStats = htmlToPlainText(editContent);
  const wordCount = plainStats.trim() ? plainStats.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = plainStats.length;

  function formatSavedLine() {
    if (isDraftNote) return "Draft — saves when the note is created";
    if (lastSavedAt == null) return "Not saved yet";
    const ago = Date.now() - lastSavedAt;
    if (ago < 45_000) return "Saved just now";
    return `Saved ${new Date(lastSavedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }

  const aiPillClass =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--input-bg)] px-2.5 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--btn-default-bg)] disabled:pointer-events-none disabled:opacity-45";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-0 border-[var(--border)] bg-[var(--bg)] md:rounded-2xl md:border">
      <NoteStudyProgressTrail
        completion={studyProgressCompletion}
        onStepPress={handleStudyProgressStep}
        disabled={improveLoading || summaryLoading}
      />

      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5 md:gap-3 md:px-4 md:py-3">
        {onOpenMobileMenu ? (
          <button
            type="button"
            aria-label="Open menu"
            onClick={onOpenMobileMenu}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] transition hover:bg-[var(--btn-default-bg)] md:hidden touch-manipulation"
          >
            <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm text-[var(--muted)] transition hover:bg-[var(--input-bg)] hover:text-[var(--text)] touch-manipulation md:h-9 md:px-2"
        >
          <ChevronRight className="h-4 w-4 rotate-180 shrink-0" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div
          className={cn(
            "min-w-0 flex-1 rounded-lg px-0.5 transition-opacity duration-300",
            titleRevealActive && "studara-title-auto-reveal",
            titleLoading && "opacity-[0.88]"
          )}
        >
          <input
            value={localTitle}
            onChange={(e) => {
              const v = e.target.value;
              setLocalTitle(v);
              onTitleDraftChange(v);
            }}
            className="w-full min-w-0 bg-transparent text-lg font-semibold tracking-tight text-[var(--text)] outline-none placeholder:text-[var(--placeholder)] md:text-xl"
            placeholder="Untitled note"
            aria-label="Note title"
          />
        </div>

        {titleLoading ? (
          <span className="inline-flex shrink-0" aria-label="Generating title">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--muted)]" aria-hidden />
          </span>
        ) : null}

        <div className="relative shrink-0" ref={categoryMenuRef}>
          <button
            type="button"
            aria-expanded={categoryMenuOpen}
            aria-haspopup="listbox"
            onClick={() => {
              setCategoryMenuOpen((o) => !o);
              setEditorMenuOpen(false);
            }}
            className="inline-flex max-w-[9.5rem] min-w-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--input-bg)] py-1 pl-2.5 pr-2 text-left text-xs font-medium text-[var(--text)] transition hover:bg-[var(--btn-default-bg)] touch-manipulation"
          >
            {categoryDotColor ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full ring-1 ring-[var(--border)]"
                style={{ backgroundColor: categoryDotColor }}
                aria-hidden
              />
            ) : null}
            <span className="min-w-0 truncate">{categoryLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
          {categoryMenuOpen ? (
            <div
              role="listbox"
              className="absolute right-0 top-full z-50 mt-1 max-h-60 min-w-[11rem] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--chrome-90)] py-1 shadow-[var(--shadow-brand-md)] app-sidebar-scrollbar"
            >
              <button
                type="button"
                role="option"
                aria-selected={!selectedNote.category_id}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
                onClick={() => {
                  onUpdate({ category_id: null });
                  setCategoryMenuOpen(false);
                }}
              >
                Uncategorized
              </button>
              {selectedNote.category_id === "pending" && !categories.some((c) => c.id === "pending") ? (
                <button
                  type="button"
                  role="option"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--muted)]"
                  disabled
                >
                  General (creating…)
                </button>
              ) : null}
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={selectedNote.category_id === c.id}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
                  onClick={() => {
                    onUpdate({ category_id: c.id });
                    setCategoryMenuOpen(false);
                  }}
                >
                  {c.color ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full ring-1 ring-[var(--border)]"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--muted)] opacity-40" aria-hidden />
                  )}
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative shrink-0" ref={editorMenuRef}>
          <button
            type="button"
            aria-label="Note actions"
            aria-expanded={editorMenuOpen}
            aria-haspopup="menu"
            onClick={() => {
              setEditorMenuOpen((o) => !o);
              setCategoryMenuOpen(false);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--input-bg)] hover:text-[var(--text)] touch-manipulation"
          >
            <MoreVertical className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          {editorMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--chrome-90)] py-1 shadow-[var(--shadow-brand-md)]"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)] disabled:opacity-40"
                disabled={!onShareNote}
                onClick={() => {
                  setEditorMenuOpen(false);
                  onShareNote?.();
                }}
              >
                <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                Share
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
                onClick={() => {
                  setEditorMenuOpen(false);
                  void onExportPdf();
                }}
              >
                <Download className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                Export PDF
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
                onClick={() => {
                  setEditorMenuOpen(false);
                  onExportMd();
                }}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                Export Markdown
              </button>
              {categories.length >= 2 ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--btn-default-bg)] disabled:opacity-45"
                  disabled={autoCategorizeLoading}
                  onClick={() => {
                    setEditorMenuOpen(false);
                    void onAutoCategorize();
                  }}
                >
                  {autoCategorizeLoading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--muted)]" />
                  ) : (
                    <Tag className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                  )}
                  Suggest category
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--status-danger-fg-strong)] hover:bg-[var(--status-danger-bg)]"
                onClick={() => {
                  setEditorMenuOpen(false);
                  onDeleteRequest();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                Delete note
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {suggestBanner ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[color:color-mix(in_oklab,var(--accent)_10%,transparent)] px-4 py-2.5 text-sm">
          <span className="text-[var(--text)]">
            Suggested category: <strong>{suggestBanner.name}</strong>
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onSuggestApply}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={onSuggestDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:pb-4 md:pt-3">
        {noteContentLoading ? (
          <div
            className="absolute inset-0 z-20 flex items-start justify-center bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] px-4 pt-20 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
            aria-label="Loading note"
          >
            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--chrome-90)] px-4 py-2.5 text-sm text-[var(--text)] shadow-lg">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--muted)]" aria-hidden />
              Loading note…
            </div>
          </div>
        ) : null}
        <NoteRichTextEditor
          key={richEditorKey}
          noteId={selectedNote.id}
          initialHtml={editContent}
          onHtmlChange={setEditContent}
          className="min-h-0 flex-1"
          aiToolbar={
            <div className="flex flex-wrap items-center gap-2 px-6 py-2 md:gap-2.5 md:py-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent)]" strokeWidth={2} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={aiPillClass}
                  disabled={summaryLoading}
                  title="Summarize with AI"
                  onClick={() => void onClaudeSummarize()}
                >
                  {summaryLoading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" strokeWidth={2} />
                  )}
                  Summarize
                </button>
                <span ref={improveButtonRef as React.RefObject<HTMLSpanElement>} className="inline-flex">
                  <button
                    type="button"
                    className={aiPillClass}
                    disabled={improveLoading}
                    title="Improve writing with AI"
                    onClick={() => void onImprove()}
                  >
                    {improveLoading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
                    Improve
                  </button>
                </span>
                <button
                  type="button"
                  className={aiPillClass}
                  disabled={tagsLoading}
                  title="Suggest tags from your note"
                  onClick={() => void onSuggestTags()}
                >
                  {tagsLoading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
                  Suggest tags
                </button>
                <button
                  type="button"
                  className={aiPillClass}
                  disabled={conceptMapLoading || conceptMapDisabled}
                  title={conceptMapDisabled ? "Add note content first" : "Concept map from your note"}
                  onClick={onConceptMap}
                >
                  {conceptMapLoading ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Network className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  )}
                  Concept map
                </button>
                <button type="button" className={aiPillClass} title="Flashcards & quizzes" onClick={onStudy}>
                  <BookOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  Study
                </button>
                {voiceToNotesToolbar ? (
                  <div className="inline-flex shrink-0 [&_button]:h-8 [&_button]:min-h-0 [&_button]:rounded-full [&_button]:border-[var(--border)] [&_button]:bg-[var(--input-bg)] [&_button]:px-2.5 [&_button]:py-0 [&_button]:text-xs [&_button]:font-medium">
                    {voiceToNotesToolbar}
                  </div>
                ) : null}
              </div>
            </div>
          }
          statusBar={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] tabular-nums text-[var(--muted)]">
              <span>{wordCount.toLocaleString()} words</span>
              <span>{charCount.toLocaleString()} characters</span>
              <span className="min-w-0">{formatSavedLine()}</span>
            </div>
          }
        />

        {summaryBelow ? (
          <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--input-bg)] px-6 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-label)]">Summary</p>
            <div className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
              <TutorMarkdown content={summaryBelow} className={summaryMarkdownLayoutClassName} />
            </div>
          </div>
        ) : null}
        {toolbarError ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-6 py-3">
            <p className="text-sm text-[var(--status-danger-fg)]">{toolbarError}</p>
            <button type="button" onClick={onToolbarErrorDismiss} className="shrink-0 text-[var(--status-danger-fg-strong)] hover:text-[var(--text)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {suggestTagsChips && suggestTagsChips.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 px-6">
            <span className="text-xs text-[var(--muted)]">Suggested tags:</span>
            {suggestTagsChips.map((tag) => (
              <Badge
                key={tag}
                className="cursor-pointer text-xs transition hover:bg-[var(--hover-bg)]"
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
        ) : null}
      </div>
    </div>
  );
}

function NoteCard({
  note,
  categories,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onSelect,
  onRequestDelete,
  onShare,
  onSummarizeFromCard,
  onStudyFromCard,
  summarizeLoading = false,
}: {
  note: Note;
  categories: Category[];
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onSelect: () => void;
  onRequestDelete: () => void;
  onShare: () => void;
  onSummarizeFromCard: () => void;
  onStudyFromCard: () => void;
  summarizeLoading?: boolean;
}) {
  const category = note.category_id ? categories.find((c) => c.id === note.category_id) : null;
  const categoryName = category?.name ?? "Uncategorized";
  const categoryColor = category?.color;
  const date = note.updated_at ?? note.created_at ?? "";
  const formattedDate = date ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
  const preview = noteContentPreview(note.content || "");

  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuWrapRef = React.useRef<HTMLDivElement>(null);

  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number } | null>(null);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const pointerCloseRef = React.useRef<(() => void) | null>(null);

  function openMenuAt(clientX: number, clientY: number) {
    const pad = 8;
    const mw = 176;
    const mh = 120;
    const x = Math.max(pad, Math.min(clientX, window.innerWidth - mw - pad));
    const y = Math.max(pad, Math.min(clientY, window.innerHeight - mh - pad));
    setCtxMenu({ x, y });
  }

  React.useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target;
      if (menuWrapRef.current && t instanceof Node && menuWrapRef.current.contains(t)) return;
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen]);

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

  function runOpen() {
    setMenuOpen(false);
    setCtxMenu(null);
    onSelect();
  }

  function runDelete() {
    setMenuOpen(false);
    setCtxMenu(null);
    onRequestDelete();
  }

  function runShare() {
    setMenuOpen(false);
    setCtxMenu(null);
    onShare();
  }

  const cardStyle = {
    borderLeftColor: categoryColor ?? "var(--border)",
  } as React.CSSProperties;

  const card = (
    <div
      style={cardStyle}
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
        "note-dashboard-card group relative box-border flex w-[280px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--border)] border-l-[3px] bg-[var(--chrome-20)] p-4 text-left outline-none backdrop-blur-xl transition duration-200",
        "hover:bg-[var(--hover-bg-subtle)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
        selectMode && "cursor-default",
        selected &&
          selectMode &&
          "border-[color:color-mix(in_oklab,var(--accent)_42%,transparent)] bg-[color:color-mix(in_oklab,var(--accent)_12%,transparent)] ring-1 ring-[color:color-mix(in_oklab,var(--accent)_26%,transparent)]"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {selectMode ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--border)] bg-[var(--btn-default-bg)] text-[var(--accent)] focus:ring-[var(--accent)]"
            aria-label={selected ? "Deselect note" : "Select note"}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-[var(--text)]">
              {note.title || "Untitled"}
            </h3>
            {!selectMode ? (
              <div ref={menuWrapRef} className="relative shrink-0">
                <button
                  type="button"
                  aria-label="Note actions"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((o) => !o);
                  }}
                  className="rounded-lg p-1 text-[var(--muted)] transition-colors hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--chrome-90)] py-1 shadow-[var(--shadow-brand-md)]"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] transition-colors hover:bg-[var(--btn-default-bg)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        runOpen();
                      }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] transition-colors hover:bg-[var(--btn-default-bg)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        runShare();
                      }}
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm text-[var(--status-danger-fg-strong)] transition-colors hover:bg-[var(--status-danger-bg)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        runDelete();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="line-clamp-2 text-sm leading-snug text-[var(--muted)]">{preview || "No content"}</p>
          <div className="flex shrink-0 flex-col gap-2">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <span
                className={cn(
                  "inline-flex min-w-0 max-w-[58%] items-center gap-1.5 truncate rounded-full px-2.5 py-0.5 text-xs font-medium",
                  !categoryColor && categoryName === "Uncategorized" && "bg-[var(--btn-default-bg)] text-[var(--muted)]",
                  !categoryColor &&
                    categoryName !== "Uncategorized" &&
                    "bg-[color:color-mix(in_oklab,var(--accent)_18%,transparent)] text-[var(--accent-fg)]"
                )}
                style={categoryColor ? { backgroundColor: `${categoryColor}30`, color: categoryColor } : undefined}
                title={categoryName}
              >
                {categoryColor ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} aria-hidden />
                ) : null}
                {categoryName}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">{formattedDate}</span>
            </div>
            {!selectMode ? (
              <div
                className="flex shrink-0 items-center justify-center gap-0.5 border-t border-[var(--border-subtle)] pt-2"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  title="Summarize"
                  aria-label="Summarize note"
                  disabled={summarizeLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSummarizeFromCard();
                  }}
                  className={cn(
                    "rounded-md p-1.5 text-[var(--muted)] transition-[opacity,background-color,color] hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] max-md:opacity-90 md:opacity-45 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
                    summarizeLoading && "pointer-events-none opacity-100"
                  )}
                >
                  {summarizeLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Zap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  title="Study"
                  aria-label="Open study mode for this note"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStudyFromCard();
                  }}
                  className="rounded-md p-1.5 text-[var(--muted)] transition-[opacity,background-color,color] hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] max-md:opacity-90 md:opacity-45 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                >
                  <GraduationCap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  title="Share"
                  aria-label="Share note"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare();
                  }}
                  className="rounded-md p-1.5 text-[var(--muted)] transition-[opacity,background-color,color] hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] max-md:opacity-90 md:opacity-45 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                >
                  <Share2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
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
              className="fixed z-[80] min-w-[9.5rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--chrome-90)] py-1 shadow-[var(--shadow-brand-md)]"
              style={{ left: ctxMenu.x, top: ctxMenu.y }}
              onPointerDown={(e) => e.stopPropagation()}
              role="menu"
              aria-label="Note actions"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] transition-colors hover:bg-[var(--btn-default-bg)]"
                onClick={() => runOpen()}
              >
                Open
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--text)] transition-colors hover:bg-[var(--btn-default-bg)]"
                onClick={() => runShare()}
              >
                Share
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[var(--status-danger-fg-strong)] transition-colors hover:bg-[var(--status-danger-bg)]"
                onClick={() => runDelete()}
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
            ? "bg-gradient-to-r from-purple-500/18 to-blue-500/10 text-[var(--text)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_28%,transparent)]"
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
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--category-dot-fallback)] ring-2 ring-[var(--border)]"
            aria-hidden
          />
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
          className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg text-[var(--accent-fg)] opacity-90 transition hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--accent)] md:opacity-0 md:group-hover:opacity-100"
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
          className="flex h-9 w-6 shrink-0 touch-manipulation items-center justify-center rounded-lg text-[var(--muted)] opacity-90 transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] md:opacity-0 md:group-hover:opacity-100"
          aria-label={`Category actions for ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-current" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      {menu && !isAll && (
        <div className="absolute left-0 top-full z-10 mt-1 w-full min-w-[8rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--chrome-90)] py-1 shadow-[var(--shadow-brand-md)]">
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
              className="block w-full px-3 py-2 text-left text-sm text-[var(--status-danger-fg-strong)] transition hover:bg-[var(--btn-default-bg)]"
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
      <Card className="studara-streak-milestone-enter relative w-full max-w-sm overflow-hidden border border-[var(--border-subtle)] bg-[var(--modal-surface)] p-8 text-center shadow-[var(--shadow-brand-lg)]">
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
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/40 via-orange-500/35 to-rose-500/30 ring-2 ring-[color:color-mix(in_oklab,var(--status-warning-border)_55%,transparent)]">
          <Flame className="h-11 w-11 text-[var(--inverse-text)]" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="relative mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-label)]">Milestone</p>
        <h2 id="streak-milestone-title" className="relative mt-2 text-2xl font-bold text-[var(--text)]">
          {title}
        </h2>
        <p className="relative mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        <p className="relative mt-4 text-5xl font-black tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-[var(--headline-stat-from)] via-[var(--headline-stat-via)] to-[var(--headline-stat-to)]">
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

function flashcardEncouragementMessage(gotIt: number, almost: number, missed: number, total: number): string {
  if (total <= 0) return "Nice work finishing the deck!";
  const pct = Math.round(((gotIt + almost) / total) * 100);
  if (missed === 0 && almost === 0) return "Flawless — every answer was solid recall.";
  if (pct >= 90) return "Outstanding — you're in great shape on this material.";
  if (pct >= 75) return "Strong session — a quick pass on the harder ones and you're set.";
  if (pct >= 50) return "Good progress — review what you missed while it's fresh.";
  return "Keep going — spaced repetition turns weak spots into strengths.";
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
  flashcardSessionRatings,
  flashcardRatingLoading,
  onFlashcardRate,
  onFlashcardsStudyAgain,
  onFlashcardsStudyMissedOnly,
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
  flashcardSessionRatings: FlashcardRating[];
  flashcardRatingLoading: boolean;
  onFlashcardRate: (rating: FlashcardRating) => void;
  onFlashcardsStudyAgain: () => void;
  onFlashcardsStudyMissedOnly: () => void;
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
        <Card className="studara-study-modal-enter relative mx-auto w-full max-w-2xl border border-[var(--border)] bg-[var(--modal-surface)] p-6 shadow-[var(--shadow-brand-lg)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 ring-1 ring-[var(--border)]">
              <GraduationCap className="h-8 w-8 text-[var(--accent-icon)]" strokeWidth={1.5} />
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

          {error && <p className="mt-4 text-center text-sm text-[var(--status-danger-fg-strong)]">{error}</p>}

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <div className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--modal-surface)] p-5 shadow-inner sm:min-h-[220px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent-icon)]">
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
                className="mt-5 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-[var(--shadow-brand-lg)] hover:from-violet-500 hover:to-indigo-500"
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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-fg)]">
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
                className="mt-5 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-[var(--shadow-brand-lg)] hover:from-violet-500 hover:to-indigo-500"
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
      let gotIt = 0;
      let almost = 0;
      let missed = 0;
      for (const r of flashcardSessionRatings) {
        if (r === "easy") gotIt += 1;
        else if (r === "good") almost += 1;
        else missed += 1;
      }
      const recallPct =
        totalCards > 0 ? Math.round(((gotIt + almost) / totalCards) * 100) : 0;
      const missedCount = flashcardSessionRatings.filter((r) => r === "hard").length;

      return (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[var(--scrim)] p-0 backdrop-blur-md sm:items-center sm:p-4">
          <Card className="relative flex max-h-dvh min-h-0 w-full max-w-lg flex-col overflow-y-auto rounded-none border-0 border-[var(--border)] bg-[var(--modal-surface)] p-6 shadow-[var(--shadow-brand-lg)] backdrop-blur-sm sm:max-h-[min(92dvh,880px)] sm:rounded-2xl sm:border sm:p-8 max-sm:flex-1">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] sm:right-5 sm:top-5"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center pt-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/35 via-purple-500/25 to-indigo-500/30 shadow-[var(--accent-glow)] ring-1 ring-[color-mix(in_oklab,var(--accent)_35%,transparent)]">
                <SquareStack className="h-9 w-9 text-[var(--accent-icon)]" strokeWidth={1.5} />
              </div>
              <h3 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--text)]">Deck complete</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {reviewDueOnly
                  ? `You finished all ${totalCards} due card${totalCards === 1 ? "" : "s"} for today.`
                  : `You worked through ${totalCards} card${totalCards === 1 ? "" : "s"}.`}
              </p>
              <p className="mt-6 text-5xl font-bold tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] via-[var(--stats-label-from)] to-[var(--accent2)]">
                {recallPct}%
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--text)]">recall score</p>
              <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm tabular-nums text-[var(--muted)]">
                <span>
                  <span className="font-semibold text-[var(--status-success-fg)]">{gotIt}</span> got it
                </span>
                <span className="text-[var(--faint)]">·</span>
                <span>
                  <span className="font-semibold text-[var(--status-warning-fg)]">{almost}</span> almost
                </span>
                <span className="text-[var(--faint)]">·</span>
                <span>
                  <span className="font-semibold text-[var(--status-danger-fg)]">{missed}</span> missed
                </span>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
                {flashcardEncouragementMessage(gotIt, almost, missed, totalCards)}
              </p>
              <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
                <Button
                  type="button"
                  className="w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] hover:from-violet-500 hover:to-indigo-500"
                  onClick={onFlashcardsStudyAgain}
                >
                  Study again
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={missedCount === 0}
                  className="w-full border border-[var(--border)] bg-[var(--input-bg)] py-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--btn-default-bg)] disabled:pointer-events-none disabled:opacity-40"
                  onClick={onFlashcardsStudyMissedOnly}
                >
                  Study missed cards only
                  {missedCount > 0 ? (
                    <span className="ml-1.5 tabular-nums text-[var(--muted)]">({missedCount})</span>
                  ) : null}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="w-full border border-[var(--border-subtle)] bg-transparent py-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-ghost)] hover:text-[var(--text)]"
                >
                  {studyLeaveButtonLabel}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    const card = flashcards[cardIndex];
    const deckProgressPct = totalCards > 0 ? ((cardIndex + 1) / totalCards) * 100 : 0;
    const faceShell =
      "absolute inset-0 flex h-[280px] w-full flex-col rounded-3xl border border-[color-mix(in_oklab,var(--accent)_38%,var(--border))] bg-[var(--surface-mid)] shadow-[0_0_40px_-8px_color-mix(in_oklab,var(--accent)_42%,transparent),inset_0_1px_0_var(--inset-shine)] [backface-visibility:hidden]";

    return (
      <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[var(--scrim)] p-0 backdrop-blur-md sm:items-center sm:p-4">
        <Card className="flex max-h-dvh min-h-0 w-full max-w-[min(100%,680px)] flex-col overflow-hidden rounded-none border-0 border-[var(--border)] bg-[var(--modal-surface)] shadow-[var(--shadow-brand-lg)] backdrop-blur-sm sm:max-h-[min(92dvh,900px)] sm:rounded-2xl sm:border sm:p-6 max-sm:flex-1">
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-0 sm:pb-0 sm:pt-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold tracking-tight text-[var(--text)] sm:text-sm">Flashcards</h3>
              {studyScope === "multi" && (
                <p className="mt-1 text-xs text-[var(--accent-label-muted)]">From multiple notes</p>
              )}
              {studyScope === "saved" && savedSetTitle && (
                <p className="mt-1 line-clamp-2 text-xs text-[var(--status-success-fg)]">{savedSetTitle}</p>
              )}
              {reviewDueOnly && (
                <p className="mt-1 text-xs font-medium text-[var(--status-warning-fg)]">Due for review today</p>
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
            <p className="mx-4 mt-2 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-center text-xs text-[var(--status-danger-fg)] sm:mx-0">
              {error}
            </p>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-0">
            {flashcardReviewDueTotal != null && flashcardReviewDueTotal > 0 ? (
              <p className="mb-2 text-center text-[11px] text-[var(--faint)]">
                Due today:{" "}
                <span className="tabular-nums text-[var(--muted)]">
                  {flashcardSessionReviewed} / {flashcardReviewDueTotal}
                </span>{" "}
                reviewed
              </p>
            ) : null}

            <div className="mx-auto w-full max-w-[600px]">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Progress</span>
                <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
                  {cardIndex + 1} of {totalCards}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--btn-default-bg)] ring-1 ring-[var(--border-subtle)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${deckProgressPct}%` }}
                />
              </div>
            </div>

            <div className="mx-auto mt-5 w-full max-w-[600px] [perspective:1400px]">
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
                  "relative h-[280px] w-full cursor-pointer transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] [transform-style:preserve-3d]",
                  cardFlipped && "[transform:rotateY(180deg)]"
                )}
                style={{ transformOrigin: "center center" }}
                aria-label={cardFlipped ? "Show question (front)" : "Show answer (back)"}
              >
                <div
                  className={cn(
                    faceShell,
                    "items-stretch justify-between px-5 py-5 text-center [transform:rotateY(0deg)]"
                  )}
                >
                  <div className="min-h-0 flex flex-1 flex-col items-center justify-center overflow-y-auto">
                    <p className="max-w-full text-lg font-bold leading-snug text-[var(--text)] [overflow-wrap:anywhere] sm:text-xl">
                      {card.front}
                    </p>
                  </div>
                  <p className="shrink-0 pt-2 text-center text-[11px] text-[var(--faint)]">Click to flip</p>
                </div>
                <div
                  className={cn(
                    faceShell,
                    "items-center justify-center overflow-y-auto px-6 py-6 text-center [transform:rotateY(180deg)]"
                  )}
                >
                  <p className="max-w-full text-base font-medium leading-relaxed text-[var(--text)] [overflow-wrap:anywhere] sm:text-lg">
                    {card.back}
                  </p>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-5 flex w-full max-w-[600px] items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onCardPrev}
                disabled={cardIndex === 0}
                className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] shadow-sm transition hover:bg-[var(--btn-default-bg)] disabled:pointer-events-none disabled:opacity-35 sm:min-h-11 sm:min-w-11"
                aria-label="Previous card"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onCardFlip();
                }}
                className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-4 text-sm font-semibold text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] transition hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500"
              >
                <FlipHorizontal className="h-4 w-4 opacity-90" strokeWidth={2} />
                Flip
              </button>
              <button
                type="button"
                onClick={onCardNext}
                disabled={cardIndex === totalCards - 1}
                className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] shadow-sm transition hover:bg-[var(--btn-default-bg)] disabled:pointer-events-none disabled:opacity-35 sm:min-h-11 sm:min-w-11"
                aria-label="Next card"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            {canPersistStudy && (
              <Button
                type="button"
                className="mx-auto mt-4 w-full max-w-[600px] border border-[var(--border)] bg-[var(--chrome-35)] py-2.5 text-sm font-medium text-[var(--text)] shadow-none hover:bg-[var(--btn-default-bg)] disabled:opacity-50"
                onClick={() => void onSaveFlashcards()}
                disabled={studySaveLoading === "flashcards"}
              >
                {studySaveLoading === "flashcards" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save to Study Sets
              </Button>
            )}

            {cardFlipped ? (
              <div className="mx-auto mt-4 w-full max-w-[600px] space-y-2">
                <p className="text-center text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">
                  How well did you know it?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={flashcardRatingLoading}
                    onClick={() => onFlashcardRate("easy")}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 text-xs font-semibold text-[var(--status-success-fg)] transition hover:brightness-110 disabled:opacity-50 sm:text-sm"
                  >
                    Got it
                  </button>
                  <button
                    type="button"
                    disabled={flashcardRatingLoading}
                    onClick={() => onFlashcardRate("good")}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 text-xs font-semibold text-[var(--status-warning-fg)] transition hover:brightness-110 disabled:opacity-50 sm:text-sm"
                  >
                    Almost
                  </button>
                  <button
                    type="button"
                    disabled={flashcardRatingLoading}
                    onClick={() => onFlashcardRate("hard")}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2 text-xs font-semibold text-[var(--status-danger-fg)] transition hover:brightness-110 disabled:opacity-50 sm:text-sm"
                  >
                    Missed it
                  </button>
                </div>
              </div>
            ) : null}
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
          <Card className="studara-study-modal-enter mx-auto w-full max-w-md border border-[var(--border)] bg-[var(--modal-surface)] p-6 text-center shadow-[var(--shadow-brand-lg)] backdrop-blur-xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/35 to-cyan-500/25 ring-1 ring-[var(--border)]">
              <GraduationCap className="h-8 w-8 text-[var(--accent-icon)]" strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-[var(--text)]">Quiz complete</h2>
            <p className="mt-2 text-5xl font-bold tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-[var(--stats-label-from)] to-[var(--stats-label-to)]">
              {finalScore}/{total}
            </p>
            <p className="mt-1 text-lg font-medium text-[var(--text)]">{pct}% correct</p>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{quizEncouragementMessage(finalScore, total)}</p>
            {error && (
              <p className="mt-4 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-fg)]">{error}</p>
            )}
            <div className="mt-8 flex flex-col gap-3">
              {canPersistStudy && (
                <Button
                  type="button"
                  className="w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-[var(--shadow-brand-lg)]"
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
                  className="w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] sm:w-auto sm:min-w-[140px]"
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
        <Card className="mx-auto flex max-h-dvh min-h-0 w-full max-w-lg flex-col overflow-y-auto overflow-x-hidden rounded-none border-0 border-[var(--border)] bg-[var(--modal-surface)] shadow-[var(--shadow-brand-lg)] backdrop-blur-sm sm:max-h-[min(92dvh,900px)] sm:rounded-2xl sm:border sm:p-6">
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 sm:px-0 sm:pt-0">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--faint)]">Quiz</p>
              <p className="mt-1 text-sm font-medium tabular-nums text-[var(--muted)]">
                Question {quizIndex + 1} of {total}
              </p>
              {studyScope === "multi" && (
                <p className="mt-1 text-xs text-[var(--accent-label-muted)]">From multiple notes</p>
              )}
              {studyScope === "saved" && savedSetTitle && (
                <p className="mt-1 line-clamp-2 text-xs text-[var(--status-success-fg)]">{savedSetTitle}</p>
              )}
              {error && (
                <p className="mt-2 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2 py-1.5 text-xs text-[var(--status-danger-fg)]">{error}</p>
              )}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--btn-default-bg)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] via-[color-mix(in_oklab,var(--accent)_60%,var(--accent2))] to-[var(--accent2)] transition-[width] duration-300 ease-out"
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
            <div className="rounded-2xl bg-gradient-to-br from-violet-500/50 via-indigo-500/35 to-cyan-500/40 p-[1px] shadow-[var(--accent-glow)]">
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
                          !revealed &&
                            String(opt).trim() &&
                            "border-[var(--border)] bg-[var(--surface-ghost)] hover:border-[color:color-mix(in_oklab,var(--accent)_35%,transparent)] hover:bg-[var(--surface-ghost-hover)]",
                          !String(opt).trim() && "cursor-not-allowed border-dashed border-[var(--border-subtle)] bg-[var(--input-bg)] opacity-40",
                          revealed &&
                            isCorrect &&
                            "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]",
                          revealed &&
                            !isCorrect &&
                            isPicked &&
                            "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
                          revealed && !isCorrect && !isPicked && "border-[var(--sidebar-border)] opacity-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold sm:h-7 sm:w-7 sm:text-xs",
                            !revealed && "bg-[var(--btn-default-bg)] text-[var(--text)]",
                            revealed && isCorrect && "bg-[color:color-mix(in_oklab,var(--status-success-bg)_90%,var(--text))] text-[var(--status-success-fg)]",
                            revealed && !isCorrect && isPicked && "bg-[var(--status-danger-bg-elevated)] text-[var(--status-danger-fg)]",
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
                      className="min-h-12 w-full border-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-base font-medium text-[var(--inverse-text)] shadow-[var(--shadow-brand-md)] touch-manipulation sm:min-h-10 sm:text-sm"
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
