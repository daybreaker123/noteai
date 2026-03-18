"use client";

import { useSession } from "next-auth/react";
import { NoteApp } from "@/components/note-app";

export default function NotesPage() {
  const { data: session, status } = useSession();

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

  return <NoteApp userId={session.user.id} />;
}
