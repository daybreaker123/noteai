"use client";

import * as React from "react";
import type { EssayAnnotation, EssayAnnotationIssueType } from "@/lib/essay-annotation-types";
import { resolveAnnotationSpans } from "@/lib/essay-annotations";
import { cn } from "@/lib/cn";

const TEXTAREA_CLASS =
  "min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-2xl border border-[var(--border)] bg-transparent p-4 text-sm leading-relaxed text-transparent caret-white shadow-inner [scrollbar-width:none] placeholder:text-[var(--placeholder)] focus:border-purple-500/45 focus:outline-none focus:ring-2 focus:ring-purple-500/25 disabled:opacity-50 [&::-webkit-scrollbar]:[display:none]";

function highlightClass(type: EssayAnnotationIssueType): string {
  switch (type) {
    case "grammar":
    case "spelling":
      return "underline decoration-2 decoration-red-400/95 underline-offset-[4px]";
    case "clarity":
      return "underline decoration-2 decoration-yellow-400/90 underline-offset-[4px]";
    case "word_choice":
      return "underline decoration-2 decoration-sky-400/95 underline-offset-[4px]";
    case "structure":
      return "underline decoration-2 decoration-orange-400/95 underline-offset-[4px]";
    default:
      return "underline decoration-2 decoration-white/40 underline-offset-[4px]";
  }
}

function buildMirrorNodes(essay: string, annotations: EssayAnnotation[]): React.ReactNode[] {
  if (!annotations.length) {
    return essay ? [essay] : [];
  }
  const raw = annotations.map((a) => ({
    text: a.text,
    type: a.type,
    suggestion: a.suggestion,
  }));
  const spans = resolveAnnotationSpans(essay, raw);
  if (!spans.length) {
    return essay ? [essay] : [];
  }
  const nodes: React.ReactNode[] = [];
  let pos = 0;
  spans.forEach((r, idx) => {
    if (r.start > pos) {
      nodes.push(<span key={`p-${pos}-${r.start}`}>{essay.slice(pos, r.start)}</span>);
    }
    const slice = essay.slice(r.start, r.end);
    nodes.push(
      <span
        key={`a-${r.start}-${r.end}-${idx}`}
        className={cn("rounded-sm bg-[var(--input-bg)] px-0.5", highlightClass(r.type))}
      >
        {slice}
      </span>
    );
    pos = r.end;
  });
  if (pos < essay.length) {
    nodes.push(<span key={`t-${pos}`}>{essay.slice(pos)}</span>);
  }
  return nodes;
}

const PLACEHOLDER = "Paste or type your essay here...";

export function EssayAnnotatedEditor({
  value,
  onChange,
  annotations,
  onBeginEdit,
  disabled,
  loading,
  embedded,
  footerSlot,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  annotations: EssayAnnotation[];
  /** Fired when the user focuses the textarea (e.g. click to edit). Parent may clear highlights. */
  onBeginEdit?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Sit inside a parent card (no outer border / fill). */
  embedded?: boolean;
  /** e.g. character count — absolutely positioned bottom-right inside the editor. */
  footerSlot?: React.ReactNode;
  className?: string;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const mirrorNodes = React.useMemo(
    () => buildMirrorNodes(value, annotations),
    [value, annotations]
  );

  const onScroll = React.useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const showPlaceholder = !value && !loading;

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      if (annotations.length > 0 && next !== value) {
        onBeginEdit?.();
      }
      onChange(next);
    },
    [annotations.length, value, onChange, onBeginEdit]
  );

  return (
    <div
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden",
        embedded
          ? "rounded-none border-0 bg-transparent shadow-none"
          : "rounded-2xl border border-[var(--border)] bg-[var(--chrome-35)] shadow-inner",
        className
      )}
    >
      <textarea
        value={value}
        onChange={handleChange}
        onScroll={onScroll}
        onFocus={() => onBeginEdit?.()}
        disabled={disabled || loading}
        placeholder={showPlaceholder ? PLACEHOLDER : undefined}
        spellCheck={false}
        className={cn(
          TEXTAREA_CLASS,
          "relative z-[1] h-full min-h-[120px]",
          footerSlot && "pb-9",
          embedded && "rounded-none"
        )}
      />
      {/* Read-only mirror: pointer-events-none so all interaction goes to the textarea */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[2] isolate overflow-hidden",
          embedded ? "rounded-none" : "rounded-2xl"
        )}
        aria-hidden
      >
        <div
          className={cn(
            "px-4 py-4 text-sm leading-relaxed text-[var(--text)] will-change-transform select-none",
            footerSlot && "pb-9"
          )}
          style={{ transform: `translateY(-${scrollTop}px)` }}
        >
          {showPlaceholder ? (
            <span className="text-[var(--placeholder)]">{PLACEHOLDER}</span>
          ) : (
            <div className="whitespace-pre-wrap break-words">{mirrorNodes}</div>
          )}
        </div>
      </div>
      {footerSlot ? (
        <div className="pointer-events-none absolute bottom-3 right-4 z-[3] text-[11px] tabular-nums text-[var(--faint)]">
          {footerSlot}
        </div>
      ) : null}
    </div>
  );
}
