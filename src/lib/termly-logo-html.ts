import fs from "node:fs";
import path from "path";

/**
 * Reuses the Termly header logo SVG from the privacy policy HTML fragment (same asset as /privacy).
 */
export function getTermlyLogoHtmlFromPrivacy(): string {
  const privacyPath = path.join(process.cwd(), "src/app/privacy/privacy-body.partial.html");
  try {
    const raw = fs.readFileSync(privacyPath, "utf-8");
    const end = raw.indexOf('<div data-custom-class="body">');
    return end > 0 ? raw.slice(0, end) : "";
  } catch {
    return "";
  }
}
