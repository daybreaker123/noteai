"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { captureAnalytics } from "@/lib/analytics";
import type { Category, Note, ApiError } from "./api-types";
import type { StreakMilestone } from "./streak-client";
import { FREE_NOTE_TOTAL } from "./plan-limits";

const FREE_SUMMARY_LIMIT = 10;

const SAVE_ERROR_MESSAGE = "Failed to save note — please check your connection.";

export function useNotesRemote(
  userId: string | null,
  options?: { onStreakMilestone?: (m: StreakMilestone) => void }
) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoadError, setNotesLoadError] = useState<string | null>(null);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [proHeavyUsage, setProHeavyUsage] = useState(false);
  const [proEstimatedSpendCents, setProEstimatedSpendCents] = useState(0);
  const [upgradeModal, setUpgradeModal] = useState<{ show: boolean; message?: string; feature?: string }>({ show: false });
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const saveErrorClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStreakMilestoneRef = useRef(options?.onStreakMilestone);
  onStreakMilestoneRef.current = options?.onStreakMilestone;

  const emitStreakFromResponse = useCallback((json: unknown) => {
    const o = json as { streak?: { milestone?: unknown } };
    const m = o.streak?.milestone;
    if (m === 7 || m === 30 || m === 100) {
      onStreakMilestoneRef.current?.(m);
    }
  }, []);

  const showSaveError = useCallback(() => {
    setSaveErrorMessage(SAVE_ERROR_MESSAGE);
    if (saveErrorClearRef.current) clearTimeout(saveErrorClearRef.current);
    saveErrorClearRef.current = setTimeout(() => {
      setSaveErrorMessage(null);
      saveErrorClearRef.current = null;
    }, 6000);
  }, []);

  const clearSaveErrorMessage = useCallback(() => {
    if (saveErrorClearRef.current) clearTimeout(saveErrorClearRef.current);
    saveErrorClearRef.current = null;
    setSaveErrorMessage(null);
  }, []);

  const fetchPlan = useCallback(async () => {
    const res = await fetch("/api/me/plan");
    const json = (await res.json()) as {
      plan?: string;
      proHeavyUsage?: boolean;
      proEstimatedSpendCents?: number;
    };
    setPlan(json.plan === "pro" ? "pro" : "free");
    setProHeavyUsage(!!json.proHeavyUsage);
    setProEstimatedSpendCents(typeof json.proEstimatedSpendCents === "number" ? json.proEstimatedSpendCents : 0);
    return json.plan === "pro";
  }, []);

  /** Re-fetch plan/usage only (lighter than full refresh). */
  const refreshPlan = useCallback(async () => {
    await fetchPlan();
  }, [fetchPlan]);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    if (!res.ok) return;
    const data = (await res.json()) as Category[];
    setCategories(Array.isArray(data) ? data : []);
  }, []);

  const fetchNotes = useCallback(async () => {
    const res = await fetch("/api/notes");
    const json = (await res.json().catch(() => null)) as Note[] | ApiError | null;
    if (!res.ok) {
      const msg =
        json && typeof json === "object" && "error" in json && typeof (json as ApiError).error === "string"
          ? (json as ApiError).error
          : "Could not load notes";
      setNotesLoadError(msg);
      setNotes([]);
      return;
    }
    setNotesLoadError(null);
    const data = json as Note[];
    setNotes(Array.isArray(data) ? data : []);
  }, []);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setNotesLoadError(null);
      return;
    }
    setLoading(true);
    setNotesLoadError(null);
    await Promise.all([fetchPlan(), fetchCategories(), fetchNotes()]);
    setLoading(false);
  }, [userId, fetchPlan, fetchCategories, fetchNotes]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApiError = useCallback((res: Response, json: ApiError | null) => {
    if (res.status === 402 && json?.code) {
      setUpgradeModal({ show: true, message: json.error });
      return true;
    }
    return false;
  }, []);

  const actions = {
    refresh: load,

    async create(categoryId: string | null, title?: string): Promise<Note | null> {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, title: title ?? "Untitled" }),
      });
      const json = (await res.json().catch(() => null)) as Note | ApiError;
      if (handleApiError(res, json as ApiError)) return null;
      if (!res.ok) return null;
      emitStreakFromResponse(json);
      const note = json as Note;
      setNotes((prev) => [...prev, note]);
      captureAnalytics("note_created", { source: "create", note_id: note.id });
      return note;
    },

    async importDocumentFromFile(
      file: File,
      categoryId: string | null
    ): Promise<
      | { readonly ok: true; note: Note; truncated: boolean }
      | { readonly ok: false; error: string }
    > {
      const form = new FormData();
      form.append("file", file);
      if (categoryId) form.append("category_id", categoryId);
      const res = await fetch("/api/notes/import-document", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as (Note & { truncated?: boolean }) | ApiError | null;
      if (!json) {
        return { ok: false, error: "Something went wrong. Please try again." };
      }
      if (res.status === 401) {
        return { ok: false, error: "Sign in to import documents." };
      }
      if (handleApiError(res, json as ApiError)) {
        return { ok: false, error: (json as ApiError).error ?? "Upgrade required" };
      }
      if (!res.ok || !("id" in json && typeof (json as Note).id === "string")) {
        const err = (json as ApiError)?.error ?? `Import failed (${res.status})`;
        return { ok: false, error: err };
      }
      const raw = json as Note & { truncated?: boolean };
      emitStreakFromResponse(raw);
      const truncated = raw.truncated === true;
      const note: Note = {
        id: raw.id,
        user_id: raw.user_id,
        category_id: raw.category_id ?? null,
        title: raw.title,
        content: raw.content,
        pinned: raw.pinned,
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        improved_at: raw.improved_at ?? null,
        summarized_at: raw.summarized_at ?? null,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
      };
      setNotes((prev) => [...prev, note]);
      captureAnalytics("note_created", { source: "import_document", note_id: note.id });
      return { ok: true, note, truncated };
    },

    async update(
      id: string,
      patch: Partial<Pick<Note, "title" | "content" | "category_id" | "pinned" | "tags">> & {
        record_improvement?: boolean;
        record_summarization?: boolean;
      }
    ) {
      if (!id || id.startsWith("draft-")) return;
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = (await res.json().catch(() => null)) as Note | ApiError;
        if (handleApiError(res, json as ApiError)) return;
        if (!res.ok) {
          showSaveError();
          return;
        }
        const note = json as Note;
        setNotes((prev) => prev.map((n) => (n.id === id ? note : n)));
      } catch {
        showSaveError();
      }
    },

    async delete(id: string): Promise<boolean> {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) return false;
      setNotes((prev) => prev.filter((n) => n.id !== id));
      return true;
    },

    /** Load one note from the server and merge into `notes` (authoritative body for editor open). */
    async fetchNoteById(id: string): Promise<Note | null> {
      if (!id || id.startsWith("draft-")) return null;
      try {
        const res = await fetch(`/api/notes/${id}`, { credentials: "include", cache: "no-store" });
        const json = (await res.json().catch(() => null)) as Note | ApiError | null;
        if (!res.ok || !json || typeof json !== "object" || !("id" in json)) {
          return null;
        }
        const note = json as Note;
        setNotes((prev) => {
          const ix = prev.findIndex((n) => n.id === note.id);
          if (ix === -1) return [...prev, note];
          const next = [...prev];
          next[ix] = note;
          return next;
        });
        return note;
      } catch {
        return null;
      }
    },

    async createCategory(name: string, color?: string): Promise<Category | null> {
      setCategoryError(null);
      try {
        const body: { name: string; color?: string } = { name };
        if (color) body.color = color;
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => null)) as Category | ApiError;
        if (handleApiError(res, json as ApiError)) return null;
        if (!res.ok) {
          const msg = (json as ApiError)?.error ?? `Failed to create category (${res.status})`;
          setCategoryError(msg);
          return null;
        }
        const cat = json as Category;
        if (!cat?.id || !cat?.name) {
          setCategoryError("Invalid response from server");
          return null;
        }
        setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
        return cat;
      } catch (err) {
        setCategoryError(err instanceof Error ? err.message : "Failed to create category");
        return null;
      }
    },

    async updateCategory(id: string, name: string) {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const json = (await res.json().catch(() => null)) as Category | ApiError;
      if (handleApiError(res, json as ApiError)) return;
      const cat = json as Category;
      setCategories((prev) => prev.map((c) => (c.id === id ? cat : c)));
    },

    async deleteCategory(id: string) {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setCategories((prev) => prev.filter((c) => c.id !== id));
    },
  };

  return {
    categories,
    notes,
    loading,
    notesLoadError,
    plan,
    proHeavyUsage,
    proEstimatedSpendCents,
    refreshPlan,
    upgradeModal,
    setUpgradeModal,
    categoryError,
    clearCategoryError: useCallback(() => setCategoryError(null), []),
    saveErrorMessage,
    clearSaveErrorMessage,
    actions,
    FREE_NOTE_LIMIT: FREE_NOTE_TOTAL,
    FREE_SUMMARY_LIMIT,
  };
}
