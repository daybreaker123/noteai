import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWeeklyStudyReportEmail } from "@/lib/email/send-transactional";
import { getSiteUrl } from "@/lib/site-url";
import {
  computeWeeklyStudyReportStats,
  listUserIdsActiveInPastWeek,
  motivationalLineForScore,
} from "@/lib/weekly-study-report-stats";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron: Sundays 20:00 UTC (see vercel.json).
 * Secured with Authorization: Bearer CRON_SECRET when CRON_SECRET is set.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[cron/weekly-study-report] CRON_SECRET is not set");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const activeIds = await listUserIdsActiveInPastWeek(now);
  if (activeIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, failed: 0, message: "No active users" });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: activeIds },
      email: { not: null },
    },
    select: { id: true, email: true, name: true },
  });

  const notesUrl = `${getSiteUrl()}/notes`;
  let sent = 0;
  let failed = 0;

  for (const u of users) {
    const email = u.email?.trim();
    if (!email) {
      failed++;
      continue;
    }
    const stats = await computeWeeklyStudyReportStats(u.id, now);
    if (!stats) {
      failed++;
      continue;
    }
    const motivationalLine = motivationalLineForScore(stats.activityScore);
    const result = await sendWeeklyStudyReportEmail({
      to: email,
      name: u.name,
      stats,
      motivationalLine,
      notesUrl,
    });
    if (result.ok) sent++;
    else failed++;

    await new Promise((r) => setTimeout(r, 120));
  }

  console.info(
    `[cron/weekly-study-report] active=${activeIds.length} recipients=${users.length} sent=${sent} failed=${failed}`
  );

  return NextResponse.json({
    ok: true,
    activeUserIds: activeIds.length,
    recipients: users.length,
    sent,
    failed,
  });
}
