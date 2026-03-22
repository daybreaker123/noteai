"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

/** Matches landing navbar: bold 22px, white → purple → fuchsia gradient (no image). */
const wordmarkClasses =
  "inline-block text-[22px] font-bold leading-none tracking-tight bg-gradient-to-r from-white via-purple-300 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(168,85,247,0.25)]";

export function StudaraWordmark({ className }: { className?: string }) {
  return <span className={cn(wordmarkClasses, className)}>Studara</span>;
}

export function StudaraWordmarkLink({
  href,
  className,
  linkClassName,
}: {
  href: string;
  className?: string;
  /** Extra classes on the `Link` wrapper */
  linkClassName?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex shrink-0 bg-transparent p-0", linkClassName)}>
      <StudaraWordmark className={className} />
    </Link>
  );
}
