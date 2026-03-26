import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  googleDocumentJsonToHtml,
  sanitizeGoogleDocTitle,
  type DocsDocumentJson,
} from "@/lib/google-docs-to-html";
import { NOTE_IMPORT_MAX_CHARS } from "@/lib/note-import-utils";
import { FREE_NOTE_TOTAL } from "@/lib/plan-limits";
import { ensureEditorHtml } from "@/lib/note-content-html";
import { recordStudyActivity, streakJson } from "@/lib/user-study-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOCS_READONLY = "https://www.googleapis.com/auth/documents.readonly";
const DRIVE_READONLY = "https://www.googleapis.com/auth/drive.readonly";

async function validateAccessToken(
  accessToken: string,
  expectedClientId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) {
    return { ok: false, message: "Your Google sign-in expired. Close this and try importing again." };
  }
  const j = (await res.json()) as { aud?: string; scope?: string; error?: string };
  if (j.error) {
    return { ok: false, message: "Google could not verify access. Try again." };
  }
  if (j.aud !== expectedClientId) {
    return { ok: false, message: "Google client configuration mismatch. Check server environment variables." };
  }
  const scopes = (j.scope ?? "").split(/\s+/).filter(Boolean);
  const hasDocs = scopes.some((s) => s === DOCS_READONLY || s.includes("documents"));
  const hasDrive = scopes.some((s) => s === DRIVE_READONLY || (s.includes("drive") && s.includes("readonly")));
  if (!hasDocs || !hasDrive) {
    return {
      ok: false,
      message: "Missing Google Drive or Docs permission. Choose Allow when Google asks for access.",
    };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    "";
  if (!clientId) {
    return NextResponse.json({ error: "Google Docs import is not configured on this server." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const accessToken = m?.[1]?.trim();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Missing Google access token. Connect Google and pick a document again." },
      { status: 400 }
    );
  }

  const valid = await validateAccessToken(accessToken, clientId);
  if (valid.ok === false) {
    return NextResponse.json({ error: valid.message }, { status: 401 });
  }

  let body: { documentId?: string; category_id?: string | null };
  try {
    body = (await req.json()) as { documentId?: string; category_id?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const documentId = body.documentId?.trim();
  if (!documentId || !/^[a-zA-Z0-9_-]+$/.test(documentId)) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  const categoryId =
    typeof body.category_id === "string" && body.category_id.trim() !== "" ? body.category_id.trim() : null;

  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plan")
    .eq("user_id", session.user.id)
    .single();
  const plan = planRow?.plan === "pro" ? "pro" : "free";
  if (plan !== "pro") {
    const { count } = await supabaseAdmin
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id);
    if ((count ?? 0) >= FREE_NOTE_TOTAL) {
      return NextResponse.json(
        {
          error: "You've reached the free limit — upgrade to Pro for unlimited notes",
          code: "FREE_LIMIT_NOTES",
        },
        { status: 402 }
      );
    }
  }

  let docRes: Response;
  try {
    docRes = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
  } catch (e) {
    console.error("[import-google-doc] fetch", e);
    return NextResponse.json(
      { error: "Could not reach Google. Check your connection and try again." },
      { status: 502 }
    );
  }

  if (docRes.status === 404) {
    return NextResponse.json(
      {
        error:
          "That document wasn’t found. It may have been deleted, or you may not have access. Open sharing in Google Docs or pick another file.",
      },
      { status: 404 }
    );
  }
  if (docRes.status === 403) {
    return NextResponse.json(
      {
        error:
          "Google denied access to this document. Make sure you can open it in Google Docs with the same account, then try again.",
      },
      { status: 403 }
    );
  }
  if (!docRes.ok) {
    const text = await docRes.text().catch(() => "");
    console.error("[import-google-doc] docs API", docRes.status, text.slice(0, 500));
    return NextResponse.json(
      { error: "Google couldn’t load that document. Try another doc or try again in a minute." },
      { status: 502 }
    );
  }

  let docJson: DocsDocumentJson;
  try {
    docJson = (await docRes.json()) as DocsDocumentJson;
  } catch {
    return NextResponse.json({ error: "Unexpected response from Google Docs." }, { status: 502 });
  }

  const title = sanitizeGoogleDocTitle(docJson.title);
  const htmlFragment = googleDocumentJsonToHtml(docJson, NOTE_IMPORT_MAX_CHARS);
  const content = ensureEditorHtml(htmlFragment);

  const { data, error } = await supabaseAdmin
    .from("notes")
    .insert({
      user_id: session.user.id,
      category_id: categoryId,
      title,
      content,
      pinned: false,
      tags: ["google-docs"],
    })
    .select()
    .single();

  if (error) {
    console.error("[import-google-doc] insert", error);
    return NextResponse.json({ error: "Couldn't save your note. Please try again." }, { status: 500 });
  }

  const streak = await recordStudyActivity(session.user.id);
  return NextResponse.json({ ...data, ...streakJson(streak) });
}
