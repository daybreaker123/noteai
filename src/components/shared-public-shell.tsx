import Link from "next/link";
import { StudaraWordmark } from "@/components/studara-wordmark";

export function SharedPublicShell({
  children,
  pageTitle,
}: {
  children: React.ReactNode;
  pageTitle: string;
}) {
  return (
    <div className="relative min-h-dvh bg-[#0a0a0f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-600/14 via-blue-500/10 to-fuchsia-500/10 blur-3xl" />
      </div>
      <header className="relative z-10 border-b border-white/[0.06] bg-[#08080c]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <StudaraWordmark />
          </Link>
          <span className="text-xs font-medium uppercase tracking-wider text-white/35">Shared</span>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{pageTitle}</h1>
        <div className="mt-8">{children}</div>
      </main>
      <footer className="relative z-10 mx-auto max-w-3xl px-5 pb-12 pt-4 sm:px-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <p className="text-sm text-white/70">Create, improve, and study your own notes with AI.</p>
          <Link
            href="/signup"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition hover:from-purple-500 hover:to-indigo-500"
          >
            Sign up to create your own notes
          </Link>
        </div>
      </footer>
    </div>
  );
}
