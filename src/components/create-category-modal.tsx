"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Card, Input } from "@/components/ui";
import { X, Loader2 } from "lucide-react";

const PRESET_COLORS = [
  "#a78bfa", // purple (accent)
  "#34d399", // emerald
  "#60a5fa", // blue
  "#f472b6", // pink
  "#fbbf24", // amber
  "#22d3ee", // cyan
  "#f97316", // orange
  "#a855f7", // violet
];

export function CreateCategoryModal({
  open,
  onClose,
  onCreate,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, color?: string) => Promise<boolean>;
  loading: boolean;
}) {
  const [name, setName] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState(PRESET_COLORS[0]);

  React.useEffect(() => {
    if (open) {
      setName("");
      setSelectedColor(PRESET_COLORS[0]);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const ok = await onCreate(trimmed, selectedColor);
    if (ok) onClose();
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
            <Card className="overflow-hidden border-[var(--border)] bg-[var(--modal-surface)] p-6 shadow-[var(--shadow-brand-lg)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text)]">New Category</h3>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="category-name" className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
                    Name
                  </label>
                  <Input
                    id="category-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Work, Personal, Ideas"
                    className="w-full"
                    autoComplete="off"
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--muted)]">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`h-9 w-9 rounded-xl border-2 transition-all ${
                          selectedColor === color
                            ? "scale-110 border-[var(--text)] ring-2 ring-[var(--border)]"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    className="flex-1"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!name.trim() || loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
