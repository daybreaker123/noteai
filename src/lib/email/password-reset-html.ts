import { getSiteUrl } from "@/lib/site-url";

export function buildPasswordResetEmailHtml(opts: { resetUrl: string }): string {
  const { resetUrl } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;background:#0a0a0f;font-family:ui-sans-serif,system-ui,sans-serif;color:rgba(255,255,255,0.9);">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0f;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px 24px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#fff;">Reset your Studara password</p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.65);">
                We received a request to reset the password for your account. This link expires in <strong>1 hour</strong>.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#a855f7,#2563eb);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:9999px;">
                  Reset password
                </a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:rgba(255,255,255,0.45);word-break:break-all;">
                If the button doesn’t work, paste this URL into your browser:<br />
                <span style="color:rgba(168,85,247,0.9);">${resetUrl}</span>
              </p>
              <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">
                If you didn’t ask for this, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.35);">
          ${getSiteUrl()}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}
