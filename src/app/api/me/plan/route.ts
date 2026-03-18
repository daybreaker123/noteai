import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ plan: "free" });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ plan: "free" });
  }
  const { data } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  const plan = data?.plan === "pro" ? "pro" : "free";
  return NextResponse.json({ plan });
}
