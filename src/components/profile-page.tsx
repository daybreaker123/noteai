"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { ArrowLeft, Loader2, Moon, Sparkles, Sun } from "lucide-react";
import { Button, Card, Badge, Input } from "@/components/ui";
import { DeleteAccountModal } from "@/components/delete-account-modal";
import { StudaraWordmarkLink } from "@/components/studara-wordmark";
import { cn } from "@/lib/cn";
import { useStudaraTheme } from "@/components/theme-provider";
import type { PlanLimits } from "@/lib/plan-limits";

type ProfilePayload = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    createdAt: string | null;
  };
  plan: {
    tier: "free" | "pro";
    planRawFromSupabase: string | null;
    stripeSubscriptionId: string | null;
    subscriptionCurrentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  usage: {
    month: string;
    notesThisMonth: number;
    totalNotes: number;
    summarizations: number;
    improvements: number;
    tutorMessages: number;
    tutorImages: number;
  };
  limits: PlanLimits;
};

function initialsFromUser(name: string | null | undefined, email: string | null | undefined) {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = email?.trim();
  if (e) {
    return e.slice(0, 2).toUpperCase();
  }
  return "?";
}

function UsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const cap = limit == null ? "Unlimited" : `${used} / ${limit}`;
  const pct = limit != null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="font-medium tabular-nums text-[var(--text)]">{cap}</span>
      </div>
      {pct != null ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--btn-default-bg)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500/80 to-blue-500/80 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium tabular-nums text-[var(--text)]">{value}</span>
    </div>
  );
}

/** Pro plan: show label + “Unlimited” only (no usage counts for AI caps). */
function AiUnlimitedRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium text-purple-200/95">Unlimited</span>
    </div>
  );
}

function AppearanceThemeRow() {
  const { theme, toggleTheme } = useStudaraTheme();
  const isDark = theme === "dark";

  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)]"
          aria-hidden
        >
          {isDark ? (
            <Sun className="h-[18px] w-[18px] text-amber-300/90" strokeWidth={2} />
          ) : (
            <Moon className="h-[18px] w-[18px] text-violet-400/90" strokeWidth={2} />
          )}
        </span>
        <span className="text-sm font-medium text-[var(--text)]">Theme</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Dark mode on, switch to light" : "Light mode on, switch to dark"}
        onClick={toggleTheme}
        className={cn(
          "inline-flex h-7 w-[2.75rem] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
          isDark ? "justify-end bg-purple-600/85" : "justify-start bg-[var(--btn-default-bg)] ring-1 ring-inset ring-[var(--border)]"
        )}
      >
        <span className="pointer-events-none h-6 w-6 rounded-full bg-white shadow-sm" />
      </button>
    </div>
  );
}

export function ProfilePage() {
  const router = useRouter();
  const [data, setData] = React.useState<ProfilePayload | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [nameEdit, setNameEdit] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [cancelMsg, setCancelMsg] = React.useState<string | null>(null);
  const [cancelErr, setCancelErr] = React.useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteErr, setDeleteErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/me/profile", { credentials: "same-origin" });
    if (res.status === 401) {
      router.replace("/login?callbackUrl=/profile");
      return;
    }
    if (!res.ok) {
      setLoadError("Could not load profile");
      return;
    }
    const json = (await res.json()) as ProfilePayload;
    setData(json);
    setNameEdit(json.user.name?.trim() ?? "");
  }, [router]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveName() {
    if (!data) return;
    const trimmed = nameEdit.trim();
    if (!trimmed) {
      setSaveMsg("Enter a display name");
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: trimmed }),
      });
      const json = (await res.json().catch(() => ({}))) as { user?: ProfilePayload["user"]; error?: string };
      if (!res.ok) {
        setSaveMsg(json.error ?? "Save failed");
        return;
      }
      if (json.user) {
        setData((d) => (d ? { ...d, user: { ...d.user, ...json.user! } } : null));
        setNameEdit(json.user.name?.trim() ?? "");
      }
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleteLoading(true);
    setDeleteErr(null);
    try {
      const res = await fetch("/api/me/account", {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteErr(json.error ?? "Could not delete account");
        return;
      }
      await signOut({ callbackUrl: "/", redirect: true });
    } finally {
      setDeleteLoading(false);
    }
  }

  async function cancelSubscription() {
    if (!confirm("Cancel Pro at the end of the current billing period? You’ll keep access until then.")) {
      return;
    }
    setCancelLoading(true);
    setCancelMsg(null);
    setCancelErr(null);
    try {
      const res = await fetch("/api/stripe/subscription/cancel", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; subscriptionCurrentPeriodEnd?: string; cancelAtPeriodEnd?: boolean };
      if (!res.ok) {
        setCancelErr(json.error ?? "Could not cancel");
        return;
      }
      await load();
      setCancelMsg("Your subscription will end after the current period.");
    } finally {
      setCancelLoading(false);
    }
  }

  if (loadError) {
    return (
      <main className="min-h-dvh bg-[var(--bg)] px-4 py-12 text-[var(--text)]">
        <p className="text-center text-red-300">{loadError}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--faint)]" />
      </main>
    );
  }

  const { user, plan, usage, limits } = data;
  const renewal =
    plan.subscriptionCurrentPeriodEnd != null
      ? new Date(plan.subscriptionCurrentPeriodEnd).toLocaleDateString(undefined, {
          dateStyle: "long",
        })
      : null;
  const memberSince =
    user.createdAt != null
      ? new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: "long" })
      : "—";

  return (
    <>
      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => {
          if (!deleteLoading) setDeleteOpen(false);
        }}
        onConfirm={deleteAccount}
        loading={deleteLoading}
        error={deleteErr}
      />
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-purple-500/[0.07] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/notes"
            className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-[var(--muted)] transition duration-200 hover:bg-[var(--hover-bg-subtle)] hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to notes
          </Link>
          <div className="flex items-center gap-2">
            <StudaraWordmarkLink href="/" />
          </div>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">Profile</h1>
        <p className="mt-2 text-base text-[var(--muted)]">Account, plan, and usage in one place</p>

        <div className="mt-12 space-y-8">
          {/* Profile */}
          <Card className="border-[var(--border-subtle)] bg-[var(--chrome-25)] p-8 backdrop-blur-xl">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Profile</h2>
            <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex shrink-0 justify-center sm:justify-start">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatars
                  <img
                    src={user.image}
                    alt=""
                    width={88}
                    height={88}
                    className="h-[88px] w-[88px] rounded-2xl border border-[var(--border)] object-cover"
                  />
                ) : (
                  <div className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl border border-[var(--border)] bg-gradient-to-br from-purple-500/30 to-blue-500/20 text-2xl font-semibold text-[var(--text)]">
                    {initialsFromUser(user.name, user.email)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="text-xs font-medium text-[var(--muted)]">Email</div>
                  <div className="truncate text-sm text-[var(--text)]">{user.email ?? "—"}</div>
                </div>
                <div>
                  <label htmlFor="display-name" className="text-xs font-medium text-[var(--muted)]">
                    Display name
                  </label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Input
                      id="display-name"
                      value={nameEdit}
                      onChange={(e) => setNameEdit(e.target.value)}
                      placeholder="Your name"
                      className="sm:max-w-xs"
                    />
                    <Button type="button" onClick={saveName} disabled={saving} className="shrink-0 sm:mb-0">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save
                    </Button>
                  </div>
                  {saveMsg ? <p className="text-xs text-emerald-400/90">{saveMsg}</p> : null}
                </div>
              </div>
            </div>
          </Card>

          {/* Appearance */}
          <Card className="border-[var(--border-subtle)] bg-[var(--chrome-25)] p-8 backdrop-blur-xl">
            <h2 className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)]">Appearance</h2>
            <AppearanceThemeRow />
          </Card>

          {/* Plan */}
          <Card className="border-[var(--border-subtle)] bg-[var(--chrome-25)] p-8 backdrop-blur-xl">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Plan &amp; billing</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-lg font-medium text-[var(--text)]">Current plan</span>
              {plan.tier === "pro" ? (
                <Badge className="border-[var(--pro-badge-border)] bg-[var(--pro-badge-bg)] text-[var(--pro-badge-fg)]">
                  Pro
                </Badge>
              ) : (
                <Badge className="border-zinc-500/35 bg-zinc-500/15 text-zinc-300">Free</Badge>
              )}
            </div>
            {plan.tier === "pro" ? (
              <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
                {renewal ? (
                  <p>
                    {plan.cancelAtPeriodEnd ? "Access until" : "Renews on"}{" "}
                    <span className="font-medium text-[var(--text)]">{renewal}</span>
                    {plan.cancelAtPeriodEnd ? " (subscription ending)" : ""}
                  </p>
                ) : (
                  <p className="text-[var(--muted)]">Renewal date will appear after your subscription syncs.</p>
                )}
                <Button
                  type="button"
                  className="border-red-500/40 bg-transparent text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                  disabled={cancelLoading || plan.cancelAtPeriodEnd || !plan.stripeSubscriptionId}
                  onClick={cancelSubscription}
                  title={
                    !plan.stripeSubscriptionId
                      ? "Subscription id not synced yet — refresh after payment or check Stripe webhook logs."
                      : undefined
                  }
                >
                  {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {plan.cancelAtPeriodEnd ? "Cancellation scheduled" : "Cancel subscription"}
                </Button>
                {!plan.stripeSubscriptionId ? (
                  <p className="text-xs text-[var(--muted)]">
                    If this stays disabled, confirm the Stripe webhook ran and stored your subscription id.
                  </p>
                ) : null}
                {cancelErr ? <p className="text-xs text-red-300">{cancelErr}</p> : null}
                {cancelMsg ? <p className="text-xs text-emerald-400/90">{cancelMsg}</p> : null}
              </div>
            ) : (
              <div className="mt-4">
                <Link
                  href="/billing"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500/80 to-blue-500/80 px-4 py-2.5 text-sm font-semibold text-[var(--inverse-text)] shadow-lg transition hover:from-purple-500 hover:to-blue-500"
                >
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </Link>
              </div>
            )}
          </Card>

          {/* Usage */}
          <Card className="border-[var(--border-subtle)] bg-[var(--chrome-25)] p-8 backdrop-blur-xl">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Usage</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {plan.tier === "pro"
                ? `Activity this month (${usage.month}) · Pro includes unlimited AI usage`
                : `This month (${usage.month}) · compared to your plan limits`}
            </p>
            <div className="mt-6 space-y-5">
              {plan.tier === "pro" ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--muted)]">Notes (account total)</span>
                    <span className="font-medium text-purple-200/95">Unlimited</span>
                  </div>
                  <StatLine label="Notes created this month" value={usage.notesThisMonth} />
                  <AiUnlimitedRow label="AI summarizations" />
                  <AiUnlimitedRow label="AI improvements" />
                  <AiUnlimitedRow label="AI Tutor messages" />
                  <AiUnlimitedRow label="Tutor images uploaded" />
                </>
              ) : (
                <>
                  <UsageRow label="Notes (account total)" used={usage.totalNotes} limit={limits.notesTotal} />
                  <StatLine label="Notes created this month" value={usage.notesThisMonth} />
                  <UsageRow
                    label="AI summarizations"
                    used={usage.summarizations}
                    limit={limits.summarizationsPerMonth}
                  />
                  <UsageRow label="AI improvements" used={usage.improvements} limit={limits.improvementsPerMonth} />
                  <UsageRow
                    label="AI Tutor messages"
                    used={usage.tutorMessages}
                    limit={limits.tutorMessagesPerMonth}
                  />
                  <UsageRow
                    label="Tutor images uploaded"
                    used={usage.tutorImages}
                    limit={limits.tutorImagesPerMonth}
                  />
                </>
              )}
            </div>
          </Card>

          {/* Account */}
          <Card className="border-[var(--border-subtle)] bg-[var(--chrome-25)] p-8 backdrop-blur-xl">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Account actions</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Member since{" "}
              <span className="font-medium text-[var(--text)]">{memberSince}</span>
            </p>
            <p className="mt-4 text-sm text-[var(--muted)]">
              Need help? Contact us at{" "}
              <a
                href="mailto:studarausersupport@gmail.com"
                className="font-medium text-violet-300/95 underline decoration-violet-400/40 underline-offset-2 transition hover:text-violet-200"
              >
                support@studara.org
              </a>
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                className="border-[var(--border)] bg-transparent hover:bg-[var(--btn-default-bg)]"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                Sign out
              </Button>
              <Button
                type="button"
                variant="danger"
                className="border-red-600/80 bg-red-600/90 text-[var(--text)] hover:bg-red-700"
                onClick={() => {
                  setDeleteErr(null);
                  setDeleteOpen(true);
                }}
              >
                Delete Account
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </main>
    </>
  );
}
