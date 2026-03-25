import { getSiteUrl } from "@/lib/site-url";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildWelcomeEmailHtml(opts: { name: string | null; dashboardUrl: string }) {
  const greeting = opts.name?.trim() ? esc(opts.name.trim()) : "there";
  const url = esc(opts.dashboardUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to Studara</title>
</head>
<body style="margin:0;padding:0;background-color:#050508;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050508;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:linear-gradient(180deg,#12121a 0%,#0a0a0f 100%);border:1px solid rgba(167,139,250,0.2);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 28px 24px;">
              <div style="font-size:13px;font-weight:600;letter-spacing:0.08em;color:#a78bfa;text-transform:uppercase;">Studara</div>
              <h1 style="margin:12px 0 0;font-size:24px;line-height:1.25;color:#fafafa;">Welcome to Studara 🎓</h1>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">
                Hi ${greeting},<br /><br />
                Thanks for joining Studara — your AI-powered study workspace. We&apos;re glad you&apos;re here.
              </p>
              <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">
                On the <strong style="color:#e9d5ff;">Free</strong> plan you can:
              </p>
              <ul style="margin:12px 0 0;padding:0 0 0 20px;color:rgba(255,255,255,0.78);font-size:15px;line-height:1.65;">
                <li style="margin-bottom:6px;">Create and organize notes (up to <strong style="color:#fafafa;">50</strong> total)</li>
                <li style="margin-bottom:6px;">AI summaries, improvements &amp; study tools within monthly limits</li>
                <li style="margin-bottom:6px;">AI Tutor chat with generous free monthly messages</li>
                <li>Flashcards, quizzes, and more — all in one place</li>
              </ul>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 0;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);">
                    <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Open your dashboard</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.45);">
                If the button doesn&apos;t work, paste this into your browser:<br />
                <span style="color:#a78bfa;word-break:break-all;">${url}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);">© ${new Date().getFullYear()} Studara · For students, built by students</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getWelcomeDashboardUrl(): string {
  return `${getSiteUrl()}/dashboard`;
}
