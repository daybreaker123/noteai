import { resend, getEmailFrom } from "@/lib/email/resend-client";
import { buildWelcomeEmailHtml, getWelcomeDashboardUrl } from "@/lib/email/welcome-html";
import { buildProUpgradeEmailHtml, type BillingCycleLabel } from "@/lib/email/pro-upgrade-html";
import { getSiteUrl } from "@/lib/site-url";

const LOG = "[email]";

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
      console.info(`${LOG} welcome sent`, { to });
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
      console.info(`${LOG} Pro upgrade sent`, { to: opts.to });
    }
  } catch (e) {
    console.error(`${LOG} Pro upgrade send exception:`, e);
  }
}
