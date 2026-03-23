"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category, Note, ApiError } from "./api-types";

const FREE_NOTE_LIMIT = 50;
const FREE_SUMMARY_LIMIT = 10;

export function useNotesRemote(userId: string | null) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [proHeavyUsage, setProHeavyUsage] = useState(false);
  const [proEstimatedSpendCents, setProEstimatedSpendCents] = useState(0);
  const [upgradeModal, setUpgradeModal] = useState<{ show: boolean; message?: string; feature?: string }>({ show: false });
  const [categoryError, setCategoryError] = useState<string | null>(null);

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
    if (!res.ok) return;
    const data = (await res.json()) as Note[];
    setNotes(Array.isArray(data) ? data : []);
  }, []);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
      const note = json as Note;
      setNotes((prev) => [...prev, note]);
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
      const truncated = raw.truncated === true;
      const note: Note = {
        id: raw.id,
        user_id: raw.user_id,
        category_id: raw.category_id ?? null,
        title: raw.title,
        content: raw.content,
        pinned: raw.pinned,
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        created_at: raw.created_at,
        updated_at: raw.updated_at,
      };
      setNotes((prev) => [...prev, note]);
      return { ok: true, note, truncated };
    },

    async update(id: string, patch: Partial<Pick<Note, "title" | "content" | "category_id" | "pinned" | "tags">>) {
      if (!id || id.startsWith("draft-")) return;
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = (await res.json().catch(() => null)) as Note | ApiError;
        if (handleApiError(res, json as ApiError)) return;
        if (!res.ok) return;
        const note = json as Note;
        setNotes((prev) => prev.map((n) => (n.id === id ? note : n)));
      } catch {
        // Network error (e.g. "Failed to fetch") - silently skip to avoid breaking the UI
      }
    },

    async delete(id: string): Promise<boolean> {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) return false;
      setNotes((prev) => prev.filter((n) => n.id !== id));
      return true;
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
    plan,
    proHeavyUsage,
    proEstimatedSpendCents,
    refreshPlan,
    upgradeModal,
    setUpgradeModal,
    categoryError,
    clearCategoryError: useCallback(() => setCategoryError(null), []),
    actions,
    FREE_NOTE_LIMIT,
    FREE_SUMMARY_LIMIT,
  };
}
