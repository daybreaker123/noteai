"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/cn";

export function TutorMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
        "prose-headings:text-white prose-a:text-blue-400",
        "prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/40 prose-pre:text-white/90",
        "prose-code:rounded prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-emerald-200 prose-code:before:content-none prose-code:after:content-none",
        "[&_.katex]:text-[0.95em]",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
