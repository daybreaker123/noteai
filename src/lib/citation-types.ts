import { stripAiHtmlCodeFence } from "@/lib/note-content-html";

export type CitationStyleId = "apa" | "mla" | "chicago" | "harvard";

export const CITATION_STYLE_OPTIONS: { id: CitationStyleId; label: string }[] = [
  { id: "apa", label: "APA" },
  { id: "mla", label: "MLA" },
  { id: "chicago", label: "Chicago" },
  { id: "harvard", label: "Harvard" },
];

export type SourceTypeId =
  | "website"
  | "book"
  | "journal"
  | "youtube"
  | "podcast"
  | "newspaper";

export const SOURCE_TYPE_OPTIONS: { id: SourceTypeId; label: string }[] = [
  { id: "website", label: "Website" },
  { id: "book", label: "Book" },
  { id: "journal", label: "Journal Article" },
  { id: "youtube", label: "YouTube Video" },
  { id: "podcast", label: "Podcast" },
  { id: "newspaper", label: "Newspaper Article" },
];

export type ParsedCitations = {
  description: string;
  apa: string;
  mla: string;
  chicago: string;
  harvard: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function parseCitationsJson(raw: string): ParsedCitations | null {
  let s = stripAiHtmlCodeFence(raw.trim());
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence) s = fence[1]!.trim();
  let obj: unknown;
  try {
    obj = JSON.parse(s) as unknown;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const description = typeof o.description === "string" ? o.description.trim() : "";
  const apa = typeof o.apa === "string" ? o.apa.trim() : "";
  const mla = typeof o.mla === "string" ? o.mla.trim() : "";
  const chicago = typeof o.chicago === "string" ? o.chicago.trim() : "";
  const harvard = typeof o.harvard === "string" ? o.harvard.trim() : "";
  if (!isNonEmptyString(apa) || !isNonEmptyString(mla) || !isNonEmptyString(chicago) || !isNonEmptyString(harvard)) {
    return null;
  }
  return {
    description: description || "Source reference for your bibliography.",
    apa,
    mla,
    chicago,
    harvard,
  };
}

export function citationsRecord(parsed: ParsedCitations): Record<CitationStyleId, string> {
  return {
    apa: parsed.apa,
    mla: parsed.mla,
    chicago: parsed.chicago,
    harvard: parsed.harvard,
  };
}
