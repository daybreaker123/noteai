"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/cn";

/** KaTeX options for tutor chat: resilient parsing + readable errors on dark UI. */
const tutorRehypeKatexOptions = {
  strict: "ignore" as const,
  trust: false,
  errorColor: "#f87171",
  /** Slightly larger display math in chat bubbles */
  maxSize: 8,
};

/**
 * Explicit element styles so tutor markdown renders correctly without @tailwindcss/typography.
 * (Prose utilities are not in this project; raw HTML from react-markdown would look unstyled.)
 */
const tutorComponents: Components = {
  h1: ({ node: _n, className, ...props }) => (
    <h1
      className={cn("mt-4 mb-2 text-lg font-semibold tracking-tight text-white first:mt-0", className)}
      {...props}
    />
  ),
  h2: ({ node: _n, className, ...props }) => (
    <h2
      className={cn(
        "mt-4 mb-2 border-b border-white/15 pb-1.5 text-base font-semibold text-white first:mt-0",
        className
      )}
      {...props}
    />
  ),
  h3: ({ node: _n, className, ...props }) => (
    <h3 className={cn("mt-3 mb-1.5 text-sm font-semibold text-white/95 first:mt-0", className)} {...props} />
  ),
  p: ({ node: _n, className, ...props }) => (
    <p className={cn("my-2 text-[0.9375rem] leading-relaxed text-white/95 last:mb-0", className)} {...props} />
  ),
  strong: ({ node: _n, className, ...props }) => (
    <strong className={cn("font-semibold text-white", className)} {...props} />
  ),
  em: ({ node: _n, className, ...props }) => (
    <em className={cn("italic text-white/90", className)} {...props} />
  ),
  ul: ({ node: _n, className, ...props }) => (
    <ul
      className={cn("my-2 list-disc space-y-1.5 pl-5 text-[0.9375rem] text-white/95 marker:text-emerald-400/90", className)}
      {...props}
    />
  ),
  ol: ({ node: _n, className, ...props }) => (
    <ol
      className={cn("my-2 list-decimal space-y-1.5 pl-5 text-[0.9375rem] text-white/95 marker:text-white/50", className)}
      {...props}
    />
  ),
  li: ({ node: _n, className, ...props }) => (
    <li className={cn("leading-relaxed [&>p]:my-1", className)} {...props} />
  ),
  blockquote: ({ node: _n, className, ...props }) => (
    <blockquote
      className={cn("my-2 border-l-2 border-purple-400/50 pl-3 text-white/80 italic", className)}
      {...props}
    />
  ),
  hr: ({ node: _n, className, ...props }) => (
    <hr className={cn("my-4 border-0 border-t border-white/15", className)} {...props} />
  ),
  a: ({ node: _n, className, ...props }) => (
    <a
      className={cn("font-medium text-blue-400 underline decoration-blue-400/50 underline-offset-2 hover:text-blue-300", className)}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: ({ node: _n, className, children, ...props }) => {
    // Fenced blocks get `language-*` on <code>; inline code has no className.
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className={cn(
            "rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.8125rem] text-emerald-200/95",
            className
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn("block font-mono text-[0.8125rem] leading-relaxed text-emerald-200/95", className)}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ node: _n, className, children, ...props }) => (
    <pre
      className={cn("my-2 overflow-x-auto rounded-lg border border-white/10 bg-black/50 p-3", className)}
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ node: _n, className, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm text-white/95", className)} {...props} />
    </div>
  ),
  thead: ({ node: _n, className, ...props }) => (
    <thead className={cn("border-b border-white/15", className)} {...props} />
  ),
  th: ({ node: _n, className, ...props }) => (
    <th className={cn("px-2 py-1.5 font-semibold text-white", className)} {...props} />
  ),
  td: ({ node: _n, className, ...props }) => (
    <td className={cn("border-b border-white/10 px-2 py-1.5 text-white/90", className)} {...props} />
  ),
};

export function TutorMarkdown({
  content,
  className,
  onImageClick,
}: {
  content: string;
  className?: string;
  /** When set, markdown images become clickable and open the tutor image lightbox. */
  onImageClick?: (src: string) => void;
}) {
  const components = React.useMemo<Components>(
    () => ({
      ...tutorComponents,
      img: ({ node: _n, className: imgClass, src, alt, ...props }) => {
        if (!src || typeof src !== "string") return null;
        const open = onImageClick
          ? () => {
              onImageClick(src);
            }
          : undefined;
        return (
          // eslint-disable-next-line @next/next/no-img-element -- markdown allows remote / data URLs from the model
          <img
            {...props}
            src={src}
            alt={typeof alt === "string" ? alt : ""}
            className={cn(
              "my-2 max-h-64 max-w-full rounded-lg border border-white/10 object-contain",
              open && "cursor-zoom-in transition-opacity hover:opacity-95",
              imgClass
            )}
            onClick={open}
            onKeyDown={
              open
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open();
                    }
                  }
                : undefined
            }
            role={open ? "button" : undefined}
            tabIndex={open ? 0 : undefined}
          />
        );
      },
    }),
    [onImageClick]
  );

  const remarkPlugins = React.useMemo(() => [remarkGfm, remarkMath, remarkBreaks], []);
  const rehypePlugins = React.useMemo(
    () => [[rehypeKatex, tutorRehypeKatexOptions] as [typeof rehypeKatex, typeof tutorRehypeKatexOptions]],
    []
  );

  return (
    <div
      className={cn(
        "tutor-markdown text-white/95",
        /* KaTeX: legible on dark chat bubbles */
        "[&_.katex]:text-[0.98em] [&_.katex]:text-white/95",
        "[&_.katex-display]:my-3 [&_.katex-display]:block [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto",
        "[&_.katex-display]:rounded-md [&_.katex-display]:px-1 [&_.katex-display]:py-0.5",
        "[&_.katex-error]:text-red-400",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
