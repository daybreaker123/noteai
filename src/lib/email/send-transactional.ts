import { resend, getEmailFrom } from "@/lib/email/resend-client";
import { buildPasswordResetEmailHtml } from "@/lib/email/password-reset-html";
import { buildWelcomeEmailHtml, getWelcomeDashboardUrl } from "@/lib/email/welcome-html";
import { buildProUpgradeEmailHtml, type BillingCycleLabel } from "@/lib/email/pro-upgrade-html";
import { buildWeeklyStudyReportEmailHtml } from "@/lib/email/weekly-study-report-html";
import { getSiteUrl } from "@/lib/site-url";
import type { WeeklyStudyReportStats } from "@/lib/weekly-study-report-stats";

const LOG = "[email]";

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn(`${LOG} RESEND_API_KEY not set — skipping password reset email`);
    return { ok: false, error: "Email not configured" };
  }
  const base = getSiteUrl();
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const html = buildPasswordResetEmailHtml({ resetUrl });
  try {
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to,
      subject: "Reset your Studara password",
      html,
    });
    if (error) {
      console.error(`${LOG} password reset send failed:`, error);
      return { ok: false, error: String(error.message ?? error) };
    }
    console.info(`${LOG} password reset sent`);
    return { ok: true };
  } catch (e) {
    console.error(`${LOG} password reset send exception:`, e);
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

export async function sendWelcomeEmail(to: string, name: string | null): Promise<void> {
  if (!resend) {
    console.warn(`${LOG} RESEND_API_KEY not set — skipping welcome email`);
    return;
  }
  const dashboardUrl = getWelcomeDashboardUrl();
  const html = buildWelcomeEmailHtml({ name, dashboardUrl });
  try {
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to,
      subject: "Welcome to Studara 🎓",
      html,
    });
    if (error) {
      console.error(`${LOG} welcome send failed:`, error);
    } else {
      console.info(`${LOG} welcome sent`);
    }
  } catch (e) {
    console.error(`${LOG} welcome send exception:`, e);
  }
}

export function formatChargeAmount(amountCents: number | null | undefined, currency: string | null | undefined): string {
  if (amountCents == null || amountCents < 0) return "—";
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amountCents / 100);
  } catch {
    return `$${(amountCents / 100).toFixed(2)}`;
  }
}

export async function sendProUpgradeEmail(opts: {
  to: string;
  name: string | null;
  amountCents: number | null | undefined;
  currency: string | null | undefined;
  billingCycle: BillingCycleLabel;
}): Promise<void> {
  if (!resend) {
    console.warn(`${LOG} RESEND_API_KEY not set — skipping Pro upgrade email`);
    return;
  }
  const dashboardUrl = `${getSiteUrl()}/dashboard`;
  const amountFormatted = formatChargeAmount(opts.amountCents, opts.currency);
  const html = buildProUpgradeEmailHtml({
    name: opts.name,
    dashboardUrl,
    amountFormatted,
    billingCycle: opts.billingCycle,
  });
  try {
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: opts.to,
      subject: "You're now on Studara Pro ✨",
      html,
    });
    if (error) {
      console.error(`${LOG} Pro upgrade send failed:`, error);
    } else {
      console.info(`${LOG} Pro upgrade sent`);
    }
  } catch (e) {
    console.error(`${LOG} Pro upgrade send exception:`, e);
  }
}

export async function sendWeeklyStudyReportEmail(opts: {
  to: string;
  name: string | null;
  stats: WeeklyStudyReportStats;
  motivationalLine: string;
  notesUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn(`${LOG} RESEND_API_KEY not set — skipping weekly study report`);
    return { ok: false, error: "Email not configured" };
  }
  const html = buildWeeklyStudyReportEmailHtml({
    name: opts.name,
    stats: opts.stats,
    motivationalLine: opts.motivationalLine,
    notesUrl: opts.notesUrl,
  });
  try {
    const { error } = await resend.emails.send({
      from: getEmailFrom(),
      to: opts.to,
      subject: "Your Weekly Study Report · Studara",
      html,
    });
    if (error) {
      console.error(`${LOG} weekly report send failed:`, error);
      return { ok: false, error: String(error.message ?? error) };
    }
    console.info(`${LOG} weekly study report sent → ${opts.to}`);
    return { ok: true };
  } catch (e) {
    console.error(`${LOG} weekly report send exception:`, e);
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}
