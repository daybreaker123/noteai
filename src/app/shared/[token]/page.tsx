import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SharedPublicShell } from "@/components/shared-public-shell";
import { resolvePublicNotePage, fetchShareRowByToken } from "@/lib/shared-content-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  const row = await fetchShareRowByToken(token);
  if (!row || row.content_type !== "note") {
    return { title: "Shared note · Studara" };
  }
  const canTitle = row.is_public || row.user_id === viewerId;
  if (!canTitle || !supabaseAdmin) return { title: "Shared note · Studara" };
  const { data: note } = await supabaseAdmin
    .from("notes")
    .select("title")
    .eq("id", row.content_id)
    .eq("user_id", row.user_id)
    .maybeSingle();
  const t = (note?.title ?? "Note").trim() || "Note";
  return { title: `${t} · Studara` };
}

export default async function SharedNotePage({ params }: Props) {
  const { token } = await params;
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  const result = await resolvePublicNotePage(token, viewerId);

  if (result.view === "not_found") {
    notFound();
  }
  if (result.view === "redirect_study") {
    redirect(`/shared/study/${result.token}`);
  }
  if (result.view === "private") {
    return (
      <SharedPublicShell pageTitle="Private note">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-6 py-12 text-center">
          <p className="text-lg text-[var(--text)]">This note is private</p>
          <p className="mt-2 text-sm text-[var(--muted)]">The owner has turned off public access for this link.</p>
        </div>
      </SharedPublicShell>
    );
  }

  const paragraphs = result.bodyPlain.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <SharedPublicShell pageTitle={result.title}>
      <article className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-5 py-6 sm:px-8 sm:py-8">
        <div className="space-y-4 text-[15px] leading-relaxed text-[var(--text)]/88">
          {paragraphs.length > 0
            ? paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {p}
                </p>
              ))
            : (
              <p className="text-[var(--muted)]">No content.</p>
              )}
        </div>
      </article>
    </SharedPublicShell>
  );
}
