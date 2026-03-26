import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Public config for Google Picker + GIS in the browser.
 * Enable Google Cloud APIs: Google Picker API, Google Docs API, Google Drive API.
 * Restrict the API key to your HTTP referrers.
 */
export async function GET() {
  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    "";
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY?.trim() ||
    process.env.GOOGLE_PICKER_API_KEY?.trim() ||
    "";

  const enabled = Boolean(clientId && apiKey);

  return NextResponse.json({
    enabled,
    clientId: enabled ? clientId : "",
    apiKey: enabled ? apiKey : "",
  });
}
