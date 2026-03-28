"use client";

import * as React from "react";
import { X, Link2, Copy, Loader2 } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { captureAnalytics } from "@/lib/analytics";
import { cn } from "@/lib/cn";

type ShareResourceModalProps = {
  open: boolean;
  onClose: () => void;
  resourceType: "note" | "study_set";
  resourceId: string;
  onCopied: () => void;
  title?: string;
};

export function ShareResourceModal({
  open,
  onClose,
  resourceType,
  resourceId,
  onCopied,
  title = "Share",
}: ShareResourceModalProps) {
  const [loading, setLoading] = React.useState(true);
  const [shareId, setShareId] = React.useState<string | null>(null);
  const [isPublic, setIsPublic] = React.useState(true);
  const [toggleSaving, setToggleSaving] = React.useState(false);
  const [copyBusy, setCopyBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pathPrefix = resourceType === "note" ? "/shared/" : "/shared/study/";
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const fullUrl = shareId && origin ? `${origin}${pathPrefix}${shareId}` : "";

  React.useEffect(() => {
    if (!open) {
      setShareId(null);
      setError(null);
      setLoading(true);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(
          `/api/share/resource?resource_type=${encodeURIComponent(resourceType)}&resource_id=${encodeURIComponent(resourceId)}`,
          { credentials: "include" }
        );
        const j = (await r.json()) as {
          share?: { share_id: string; is_public: boolean } | null;
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok) {
          setError(j.error ?? "Could not load share settings");
          setLoading(false);
          return;
        }
        if (j.share) {
          setShareId(j.share.share_id);
          setIsPublic(j.share.is_public);
          setLoading(false);
          return;
        }
        const cr = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId }),
        });
        const cj = (await cr.json()) as { share_id?: string; is_public?: boolean; error?: string };
        if (cancelled) return;
        if (!cr.ok || !cj.share_id) {
          setError(cj.error ?? "Could not create share link");
          setLoading(false);
          return;
        }
        setShareId(cj.share_id);
        setIsPublic(cj.is_public ?? true);
      } catch {
        if (!cancelled) setError("Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, resourceType, resourceId]);

  async function handleToggle(next: boolean) {
    if (!shareId) return;
    setToggleSaving(true);
    try {
      const res = await fetch(`/api/share/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_public: next }),
      });
      if (res.ok) setIsPublic(next);
    } finally {
      setToggleSaving(false);
    }
  }

  async function handleCopy() {
    if (!fullUrl) return;
    setCopyBusy(true);
    try {
      await navigator.clipboard.writeText(fullUrl);
      if (resourceType === "note") {
        captureAnalytics("note_shared", { resource_id: resourceId });
      }
      onCopied();
    } catch {
      setError("Could not copy — try selecting the link manually.");
    } finally {
      setCopyBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <Card className="relative w-full max-w-md border-[var(--border)] bg-[var(--modal-surface)] p-6 shadow-[var(--shadow-brand-lg)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 pr-10">
          <Link2 className="h-5 w-5 text-[var(--accent-fg)]" aria-hidden />
          <h2 id="share-modal-title" className="text-lg font-semibold text-[var(--text)]">
            {title}
          </h2>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Anyone with the link can view this {resourceType === "note" ? "note" : "study set"} when it is public.
        </p>

        {loading ? (
          <div className="mt-8 flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--faint)]" />
          </div>
        ) : error ? (
          <p className="mt-6 text-sm text-red-300">{error}</p>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--chrome-30)] px-3 py-2.5">
              <p className="break-all text-xs leading-relaxed text-[var(--text)]">{fullUrl || "—"}</p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">Public link</p>
                <p className="text-xs text-[var(--muted)]">
                  {isPublic ? "Visible to anyone with the link" : "Only you can view when signed in"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                disabled={toggleSaving || !shareId}
                onClick={() => void handleToggle(!isPublic)}
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                  isPublic ? "bg-purple-600" : "bg-white/20",
                  (toggleSaving || !shareId) && "opacity-50"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                    isPublic ? "left-5" : "left-0.5"
                  )}
                />
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                type="button"
                className="flex-1 gap-2 border-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-[var(--inverse-text)]"
                disabled={!fullUrl || copyBusy}
                onClick={() => void handleCopy()}
              >
                {copyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Copy link
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
