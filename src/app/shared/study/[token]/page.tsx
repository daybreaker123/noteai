import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SharedPublicShell } from "@/components/shared-public-shell";
import { SharedStudyPublic } from "@/components/shared-study-public";
import { resolvePublicStudyPage, fetchShareRowByToken } from "@/lib/shared-content-server";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  const row = await fetchShareRowByToken(token);
  if (!row || row.content_type !== "study_set") {
    return { title: "Shared study set · Studara" };
  }
  const canTitle = row.is_public || row.user_id === viewerId;
  if (!canTitle) return { title: "Shared study set · Studara" };
  const result = await resolvePublicStudyPage(token, viewerId);
  if (result.view !== "ok") {
    return { title: "Shared study set · Studara" };
  }
  return { title: `${result.title} · Studara` };
}

export default async function SharedStudyPage({ params }: Props) {
  const { token } = await params;
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  const result = await resolvePublicStudyPage(token, viewerId);

  if (result.view === "not_found") {
    notFound();
  }
  if (result.view === "redirect_note") {
    redirect(`/shared/${result.token}`);
  }
  if (result.view === "private") {
    return (
      <SharedPublicShell pageTitle="Private study set">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
          <p className="text-lg text-white/85">This study set is private</p>
          <p className="mt-2 text-sm text-white/45">The owner has turned off public access for this link.</p>
        </div>
      </SharedPublicShell>
    );
  }

  return (
    <SharedPublicShell pageTitle={result.title}>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 sm:px-8 sm:py-8">
        <SharedStudyPublic kind={result.kind} cards={result.cards} questions={result.questions} />
      </div>
    </SharedPublicShell>
  );
}
