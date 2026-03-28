"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Card } from "@/components/ui";
import { X } from "lucide-react";

export function DeleteAccountModal({
  open,
  onClose,
  onConfirm,
  loading,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
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
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <Card className="overflow-hidden border-[var(--border)] bg-[var(--modal-surface)] p-6 shadow-[var(--shadow-brand-lg)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h3 id="delete-account-title" className="text-lg font-semibold text-[var(--text)]">
                  Delete account
                </h3>
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
              <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
                Are you sure you want to delete your account? This will permanently delete all your notes, categories,
                and data. This cannot be undone.
              </p>
              {error ? (
                <p className="mt-3 text-sm text-red-300" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="sm:min-w-[100px]">
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleConfirm}
                  disabled={loading}
                  className="border-red-600 bg-red-600 hover:bg-red-700 sm:min-w-[140px]"
                >
                  {loading ? "Deleting…" : "Delete Account"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
