/**
 * Browser-only: Google Identity Services + Picker + OAuth access token for Docs import.
 */

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const GAPI_SCRIPT = "https://apis.google.com/js/api.js";

export const GOOGLE_DOCS_IMPORT_SCOPES =
  "https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/drive.readonly";

export type GoogleDocsClientConfig = {
  enabled: boolean;
  clientId: string;
  apiKey: string;
};

export async function fetchGoogleDocsClientConfig(): Promise<GoogleDocsClientConfig> {
  const res = await fetch("/api/google-docs/config", { credentials: "include" });
  if (!res.ok) {
    return { enabled: false, clientId: "", apiKey: "" };
  }
  const j = (await res.json()) as { enabled?: boolean; clientId?: string; apiKey?: string };
  return {
    enabled: Boolean(j.enabled && j.clientId && j.apiKey),
    clientId: typeof j.clientId === "string" ? j.clientId : "",
    apiKey: typeof j.apiKey === "string" ? j.apiKey : "",
  };
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if ((existing as HTMLScriptElement).dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    const g = window.gapi;
    if (!g?.load) {
      reject(new Error("Google API client not available"));
      return;
    }
    g.load("picker", {
      callback: () => resolve(),
      onerror: () => reject(new Error("Could not load Google Picker")),
    });
  });
}

function requestGoogleAccessToken(clientId: string): Promise<string> {
  const google = window.google;
  if (!google?.accounts?.oauth2?.initTokenClient) {
    return Promise.reject(new Error("Google sign-in script not available"));
  }
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DOCS_IMPORT_SCOPES,
      callback: (resp: { access_token?: string; error?: string; error_description?: string }) => {
        if (resp.error) {
          const msg = resp.error_description ?? resp.error;
          reject(new Error(msg === "access_denied" ? "Google access was cancelled." : msg));
          return;
        }
        if (resp.access_token) {
          resolve(resp.access_token);
          return;
        }
        reject(new Error("No access token from Google"));
      },
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
}

/**
 * Opens account chooser (if needed) and the Drive file picker filtered to Google Docs.
 * @returns document file id and the same access token to send to the import API.
 */
export async function pickGoogleDocWithAccessToken(
  clientId: string,
  apiKey: string
): Promise<{ documentId: string; accessToken: string } | { cancelled: true }> {
  await loadScriptOnce(GIS_SCRIPT);
  await loadScriptOnce(GAPI_SCRIPT);
  await loadPickerApi();

  const accessToken = await requestGoogleAccessToken(clientId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gpicker = (window as any).google?.picker;
  if (!gpicker) {
    throw new Error("Google Picker is not available. Try refreshing the page.");
  }

  const documentId = await new Promise<string | null>((resolve) => {
    const docsView = new gpicker.DocsView()
      .setIncludeFolders(true)
      .setMimeTypes("application/vnd.google-apps.document");

    const builder = new gpicker.PickerBuilder()
      .addView(docsView)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data: Record<string, unknown>) => {
        const R = gpicker.Response ?? {};
        const A = gpicker.Action ?? {};
        const action = data[R.ACTION ?? "action"];
        if (action === A.PICKED || action === "picked") {
          const docs = (data[R.DOCUMENTS ?? "docs"] ?? data.docs) as { id?: string }[] | undefined;
          const id = docs?.[0]?.id;
          if (id) resolve(id);
          else resolve(null);
        } else if (action === A.CANCEL || action === "cancel") {
          resolve(null);
        }
      });

    try {
      const picker = builder.build();
      picker.setVisible(true);
    } catch (e) {
      console.error("[google-docs-import] picker build", e);
      resolve(null);
    }
  });

  if (!documentId) {
    return { cancelled: true };
  }

  return { documentId, accessToken };
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
    gapi?: {
      load: (
        api: string,
        options: {
          callback: () => void;
          onerror?: () => void;
        }
      ) => void;
    };
  }
}
