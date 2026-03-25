function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type BillingCycleLabel = "monthly" | "annual";

export function buildProUpgradeEmailHtml(opts: {
  name: string | null;
  dashboardUrl: string;
  amountFormatted: string;
  billingCycle: BillingCycleLabel;
}) {
  const greeting = opts.name?.trim() ? esc(opts.name.trim()) : "there";
  const url = esc(opts.dashboardUrl);
  const amount = esc(opts.amountFormatted);
  const cycleLabel = opts.billingCycle === "annual" ? "Annual" : "Monthly";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Studara Pro</title>
</head>
<body style="margin:0;padding:0;background-color:#050508;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050508;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:linear-gradient(180deg,#12121a 0%,#0a0a0f 100%);border:1px solid rgba(167,139,250,0.25);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px 24px;">
              <div style="font-size:13px;font-weight:600;letter-spacing:0.08em;color:#a78bfa;text-transform:uppercase;">Studara Pro</div>
              <h1 style="margin:12px 0 0;font-size:24px;line-height:1.25;color:#fafafa;">You&apos;re now on Studara Pro ✨</h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">
                Hi ${greeting},<br /><br />
                Your upgrade is confirmed. Thank you for supporting Studara — you now have full access to every AI feature.
              </p>
              <table role="presentation" width="100%" style="margin:20px 0 0;background:rgba(167,139,250,0.08);border-radius:12px;border:1px solid rgba(167,139,250,0.15);">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#c4b5fd;text-transform:uppercase;">Payment summary</p>
                    <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#fafafa;">${amount}</p>
                    <p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,0.65);">${cycleLabel} billing</p>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">
                <strong style="color:#e9d5ff;">Pro</strong> includes:
              </p>
              <ul style="margin:12px 0 0;padding:0 0 0 20px;color:rgba(255,255,255,0.78);font-size:15px;line-height:1.65;">
                <li style="margin-bottom:6px;"><strong style="color:#fafafa;">Unlimited</strong> notes &amp; organization</li>
                <li style="margin-bottom:6px;"><strong style="color:#fafafa;">Unlimited</strong> AI — summaries and improvements</li>
                <li style="margin-bottom:6px;">AI Tutor with unlimited messages &amp; higher image limits</li>
                <li style="margin-bottom:6px;">Flashcards, quizzes, study sets &amp; multi-note study flows</li>
                <li>Priority experience during heavy usage periods</li>
              </ul>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 0;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);">
                    <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Go to your dashboard</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.45);">
                Manage your subscription anytime from your profile.<br />
                <span style="color:#a78bfa;word-break:break-all;">${url}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);">© ${new Date().getFullYear()} Studara · Questions? Reply isn&apos;t monitored — use in-app support.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
