import JSZip from "jszip";
import { PDFParse } from "pdf-parse";

/**
 * Decode minimal XML entities in OOXML text runs.
 */
function decodeXmlText(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\u0022")
    .replace(/&#39;/g, "\u0027")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Collect visible text from a single pptx slide XML (DrawingML + WordprocessingML runs).
 */
function extractRunsFromSlideXml(xml: string): string[] {
  const parts: string[] = [];
  const patterns = [/<a:t[^>]*>([^<]*)<\/a:t>/gi, /<w:t[^>]*>([^<]*)<\/w:t>/gi];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const t = decodeXmlText(m[1] ?? "").replace(/\s+/g, " ").trim();
      if (t) parts.push(t);
    }
  }
  return parts;
}

function slideIndexFromPath(path: string): number {
  const n = path.replace(/\\/g, "/");
  const m = n.match(/slide(\d+)\.xml$/i);
  return m ? parseInt(m[1]!, 10) : 0;
}

/**
 * Extract text per slide from a .pptx buffer (OOXML zip). Uses JSZip to read slide XML —
 * officegen is for authoring, not parsing; this matches typical pptx2json-style extraction.
 */
export async function extractPptxSlidesText(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter((raw) => {
    const entry = zip.files[raw];
    if (!entry || entry.dir) return false;
    const n = raw.replace(/\\/g, "/");
    return /^ppt\/slides\/slide\d+\.xml$/i.test(n);
  });
  names.sort((a, b) => slideIndexFromPath(a) - slideIndexFromPath(b));

  const blocks: string[] = [];
  for (const name of names) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async("string");
    const runs = extractRunsFromSlideXml(xml);
    const body = runs.join(" ").replace(/\s+/g, " ").trim();
    const n = slideIndexFromPath(name);
    if (body) {
      blocks.push(`### Slide ${n}\n${body}`);
    }
  }

  return blocks.join("\n\n").trim();
}

/**
 * Extract PDF text with explicit page boundaries for the lecture prompt.
 */
export async function extractPdfSlidesTextByPage(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    const pages = result.pages ?? [];
    if (pages.length === 0) {
      return (result.text ?? "").trim();
    }
    return pages
      .map((p) => {
        const t = (p.text ?? "").replace(/\r\n/g, "\n").trim();
        return t ? `### Page ${p.num}\n${t}` : "";
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();
  } finally {
    await parser.destroy();
  }
}
