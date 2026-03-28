"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Card } from "@/components/ui";
import { X } from "lucide-react";

export function DeleteNoteModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm"
            onClick={loading ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-sm"
          >
            <Card className="overflow-hidden border-[var(--border)] bg-[var(--modal-surface)] p-6 shadow-[var(--shadow-brand-lg)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text)]">Delete note</h3>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)] disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">
                Are you sure you want to delete this note? This cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="flex-1">
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
