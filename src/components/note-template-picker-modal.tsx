"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui";
import {
  X,
  Columns2,
  Presentation,
  FlaskConical,
  BookOpen,
  Users,
  ListTree,
  ClipboardCheck,
  Sigma,
  type LucideIcon,
} from "lucide-react";
import {
  NOTE_TEMPLATE_LABELS,
  NOTE_TEMPLATE_ORDER,
  type NoteTemplateId,
} from "@/lib/note-templates";

const TEMPLATE_ICONS: Record<NoteTemplateId, LucideIcon> = {
  cornell: Columns2,
  lecture: Presentation,
  lab: FlaskConical,
  book: BookOpen,
  meeting: Users,
  essay: ListTree,
  studyPlan: ClipboardCheck,
  problemSet: Sigma,
};

export function NoteTemplatePickerModal({
  open,
  onClose,
  onBlankNote,
  onPickTemplate,
}: {
  open: boolean;
  onClose: () => void;
  onBlankNote: () => void;
  onPickTemplate: (id: NoteTemplateId) => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-template-picker-title"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative max-h-[min(90dvh,720px)] w-full max-w-3xl overflow-hidden"
          >
            <Card className="flex max-h-[min(90dvh,720px)] flex-col overflow-hidden border-[var(--border)] bg-[var(--modal-surface)] p-0 shadow-[var(--shadow-brand-lg)] backdrop-blur-xl">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4 md:px-6">
                <div>
                  <h2
                    id="note-template-picker-title"
                    className="text-lg font-semibold tracking-tight text-[var(--text)] md:text-xl"
                  >
                    New note
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Start blank or choose a template. You can edit everything in the editor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
                <button
                  type="button"
                  onClick={() => {
                    onBlankNote();
                    onClose();
                  }}
                  className="mb-6 flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-gradient-to-r from-[var(--tutor-sidebar-active-from)] to-[var(--tutor-sidebar-active-to)] px-4 py-3.5 text-sm font-semibold text-[var(--text)] shadow-[inset_0_2px_8px_var(--shadow-composer-inset)] transition hover:from-[color-mix(in_oklab,var(--accent)_18%,transparent)] hover:to-[color-mix(in_oklab,var(--accent)_12%,transparent)]"
                >
                  Blank note
                </button>

                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">Use template</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {NOTE_TEMPLATE_ORDER.map((id) => {
                    const { name, description } = NOTE_TEMPLATE_LABELS[id];
                    const Icon = TEMPLATE_ICONS[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onPickTemplate(id);
                          onClose();
                        }}
                        className="group flex touch-manipulation flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-ghost)] p-3 text-left transition hover:border-[var(--accent-nudge-border)] hover:bg-[var(--badge-free-bg)]"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-nudge-bg)] text-[var(--accent-icon)] ring-1 ring-[var(--accent-nudge-border)] transition group-hover:bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]">
                          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                        </span>
                        <span className="mt-2.5 text-sm font-semibold text-[var(--text)]">{name}</span>
                        <span className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--muted)]">{description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
