"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { NoteApp } from "@/components/note-app";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function StudySetReviewDueContent() {
  const params = useParams();
  const router = useRouter();
  const raw = params.setId;
  const setId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const { data: session, status } = useSession();

  const invalidId = Boolean(session?.user?.id && !UUID_RE.test(setId));

  useEffect(() => {
    if (status !== "loading" && invalidId) {
      router.replace("/study-sets");
    }
  }, [status, invalidId, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Loading…</div>
      </div>
    );
  }

  if (!session?.user?.id) {
    return null;
  }
  if (invalidId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--muted)]">Loading…</div>
      </div>
    );
  }

  return (
    <NoteApp
      userId={session.user.id}
      initialReviewDueSetId={setId}
      studyReturnPath="/study-sets"
      minimalChromeUntilStudyOpen
    />
  );
}

export default function StudySetReviewDuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
          <div className="text-[var(--muted)]">Loading…</div>
        </div>
      }
    >
      <StudySetReviewDueContent />
    </Suspense>
  );
}
