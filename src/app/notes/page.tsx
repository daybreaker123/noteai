"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { NoteApp } from "@/components/note-app";

function NotesContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const openStudySet = searchParams.get("openStudySet");
  const reviewDueSet = searchParams.get("reviewDueSet");

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0f]">
        <div className="text-white/70">Loading…</div>
      </div>
    );
  }

  if (!session?.user?.id) {
    return null;
  }

  return (
    <NoteApp
      userId={session.user.id}
      initialOpenStudySetId={openStudySet}
      initialReviewDueSetId={reviewDueSet}
      minimalChromeUntilStudyOpen={Boolean(openStudySet || reviewDueSet)}
    />
  );
}

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0f]">
          <div className="text-white/70">Loading…</div>
        </div>
      }
    >
      <NotesContent />
    </Suspense>
  );
}
