"use client";

import { useSession } from "next-auth/react";
import { TutorPage } from "@/components/tutor-page";

export default function TutorRoutePage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Loading…</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <TutorPage />;
}
