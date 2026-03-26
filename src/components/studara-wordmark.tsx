"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

/** Bold 22px gradient; colors follow theme via CSS variables. */
const wordmarkClasses =
  "inline-block text-[22px] font-bold leading-none tracking-tight bg-gradient-to-r from-[var(--wordmark-from)] via-[var(--wordmark-via)] to-[var(--wordmark-to)] bg-clip-text text-transparent drop-shadow-[0_0_24px_var(--wordmark-shadow)]";

export function StudaraWordmark({ className }: { className?: string }) {
  return <span className={cn(wordmarkClasses, className)}>Studara</span>;
}

export function StudaraWordmarkLink({
  href,
  className,
  linkClassName,
  onClick,
}: {
  href: string;
  className?: string;
  /** Extra classes on the `Link` wrapper */
  linkClassName?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn("inline-flex shrink-0 bg-transparent p-0", linkClassName)}
    >
      <StudaraWordmark className={className} />
    </Link>
  );
}
