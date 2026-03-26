"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Card } from "@/components/ui";
import { X } from "lucide-react";

export function DeleteCategoryModal({
  open,
  categoryName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  categoryName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-sm"
          >
            <Card className="overflow-hidden border-[var(--border)] bg-[var(--chrome-40)] p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text)]">Delete Category</h3>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-4 text-sm text-[var(--muted)]">
                Are you sure you want to delete <strong className="text-[var(--text)]">{categoryName}</strong>? Notes in this
                category will become uncategorized and can be reassigned later from the All Notes view.
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleConfirm}
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
