import { getSiteUrl } from "@/lib/site-url";
import type { WeeklyStudyReportStats } from "@/lib/weekly-study-report-stats";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statRow(label: string, value: string | number, hint?: string): string {
  const h = hint
    ? `<div style="font-size:11px;color:rgba(255,255,255,0.38);margin-top:2px;">${esc(hint)}</div>`
    : "";
  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px;color:rgba(255,255,255,0.72);">${esc(label)}</td>
    <td align="right" style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:16px;font-weight:600;color:#fafafa;">${typeof value === "number" ? value : esc(value)}</td>
  </tr>${h ? `<tr><td colspan="2" style="padding:0 0 8px;">${h}</td></tr>` : ""}`;
}

export function buildWeeklyStudyReportEmailHtml(opts: {
  name: string | null;
  stats: WeeklyStudyReportStats;
  motivationalLine: string;
  notesUrl: string;
}): string {
  const site = getSiteUrl();
  const logoUrl = esc(`${site}/studara-logo.svg`);
  const notes = esc(opts.notesUrl);
  const greeting = opts.name?.trim() ? esc(opts.name.trim()) : "there";
  const motiv = esc(opts.motivationalLine);
  const topCat = opts.stats.topCategoryName ? esc(opts.stats.topCategoryName) : "—";

  const s = opts.stats;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your Weekly Study Report</title>
</head>
<body style="margin:0;padding:0;background-color:#050508;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#050508;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:linear-gradient(180deg,#16161f 0%,#0c0c12 100%);border:1px solid rgba(139,92,246,0.25);border-radius:20px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.45);">
          <tr>
            <td style="padding:28px 28px 20px;background:linear-gradient(135deg,rgba(124,58,237,0.12) 0%,rgba(79,70,229,0.08) 50%,transparent 100%);">
              <img src="${logoUrl}" width="132" height="auto" alt="Studara" style="display:block;max-width:132px;height:auto;" />
              <h1 style="margin:20px 0 0;font-size:26px;line-height:1.2;letter-spacing:-0.02em;color:#fafafa;">Your Weekly Study Report</h1>
              <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.55);">The last 7 days on Studara</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;">
              <p style="margin:0;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.82);">Hi ${greeting},</p>
              <table role="presentation" width="100%" style="margin-top:20px;background:rgba(124,58,237,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:14px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.06em;color:#c4b5fd;text-transform:uppercase;">Current streak</p>
                    <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#fafafa;line-height:1;">🔥 ${s.currentStreak} <span style="font-size:16px;font-weight:500;color:rgba(255,255,255,0.5);">day${s.currentStreak === 1 ? "" : "s"}</span></p>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;font-size:16px;line-height:1.55;color:#e9d5ff;font-weight:500;">${motiv}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
                ${statRow("Notes created", s.notesCreated)}
                ${statRow("Flashcard sets studied", s.flashcardSetsStudied)}
                ${statRow("Quizzes taken", s.quizzesTaken)}
                ${statRow("AI summarizations", s.summarizationsUsed)}
                ${statRow("Essay feedback received", s.essayFeedbacksReceived, "Month to date (resets each calendar month)")}
              </table>
              <table role="presentation" width="100%" style="margin-top:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.06em;color:rgba(255,255,255,0.45);text-transform:uppercase;">Top studied area</p>
                    <p style="margin:6px 0 0;font-size:17px;font-weight:600;color:#fafafa;">${topCat}</p>
                    <p style="margin:6px 0 0;font-size:12px;line-height:1.45;color:rgba(255,255,255,0.4);">Based on flashcards &amp; quizzes from your saved study sets this week.</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 0;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#7c3aed 0%,#6366f1 55%,#4f46e5 100%);box-shadow:0 8px 32px rgba(124,58,237,0.35);">
                    <a href="${notes}" style="display:inline-block;padding:15px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Continue studying</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.4);">
                Button not working? Open: <span style="color:#a78bfa;word-break:break-all;">${notes}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 26px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.32);">© ${new Date().getFullYear()} Studara · Sent weekly on Sundays</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
