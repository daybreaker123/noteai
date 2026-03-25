import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserStatsDashboard } from "@/lib/user-study-stats";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dashboard = await getUserStatsDashboard(session.user.id);
  if (!dashboard) {
    return NextResponse.json(
      { error: "Stats unavailable" },
      { status: 503 }
    );
  }

  return NextResponse.json(dashboard);
}
