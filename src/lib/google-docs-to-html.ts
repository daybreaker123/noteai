/**
 * Convert Google Docs API v1 `documents.get` JSON to a Tiptap-friendly HTML fragment.
 * @see https://developers.google.com/docs/api/reference/rest/v1/documents
 */

export type DocsStructuralElement = {
  paragraph?: DocsParagraph;
  table?: DocsTable;
  sectionBreak?: unknown;
  tableOfContents?: unknown;
};

export type DocsDocumentJson = {
  title?: string;
  body?: { content?: DocsStructuralElement[] };
  lists?: Record<
    string,
    {
      listProperties?: {
        nestingLevels?: Array<{
          glyphSymbol?: string;
          glyphType?: string;
        }>;
      };
    }
  >;
};

type DocsParagraph = {
  elements?: DocsParagraphElement[];
  paragraphStyle?: {
    namedStyleType?: string;
    headingId?: string;
  };
  bullet?: {
    listId?: string;
    nestingLevel?: number;
  };
};

type DocsParagraphElement = {
  textRun?: {
    content?: string;
    textStyle?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      link?: { url?: string };
    };
  };
  inlineObjectElement?: unknown;
  pageBreak?: unknown;
  columnBreak?: unknown;
  footnoteReference?: unknown;
  horizontalRule?: unknown;
};

type DocsTable = {
  rows?: number;
  columns?: number;
  tableRows?: DocsTableRow[];
};

type DocsTableRow = {
  tableCells?: DocsTableCell[];
};

type DocsTableCell = {
  content?: DocsStructuralElement[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapTextRun(
  text: string,
  style?: { bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean; link?: { url?: string } }
): string {
  if (!text) return "";
  let out = esc(text);
  const ts = style;
  if (!ts) return out;
  if (ts.strikethrough) out = `<s>${out}</s>`;
  if (ts.underline) out = `<u>${out}</u>`;
  if (ts.italic) out = `<em>${out}</em>`;
  if (ts.bold) out = `<strong>${out}</strong>`;
  if (ts.link?.url) {
    const u = ts.link.url;
    if (/^https?:\/\//i.test(u)) {
      out = `<a href="${esc(u)}" rel="noopener noreferrer">${out}</a>`;
    }
  }
  return out;
}

function paragraphTag(namedStyleType: string | undefined): string {
  switch (namedStyleType) {
    case "HEADING_1":
    case "TITLE":
      return "h1";
    case "HEADING_2":
    case "SUBTITLE":
      return "h2";
    case "HEADING_3":
      return "h3";
    case "HEADING_4":
      return "h4";
    case "HEADING_5":
      return "h5";
    case "HEADING_6":
      return "h6";
    default:
      return "p";
  }
}

function renderParagraphElements(elements: DocsParagraphElement[] | undefined): string {
  if (!elements?.length) return "";
  const parts: string[] = [];
  for (const el of elements) {
    if (el.horizontalRule) {
      parts.push("<hr>");
      continue;
    }
    if (el.textRun?.content != null) {
      parts.push(wrapTextRun(el.textRun.content, el.textRun.textStyle));
    }
  }
  return parts.join("");
}

function closeListStack(stack: number[], out: string[]): void {
  while (stack.length > 0) {
    stack.pop();
    out.push("</ul>");
  }
}

function ensureListDepth(stack: number[], targetDepth: number, out: string[]): void {
  while (stack.length < targetDepth) {
    out.push("<ul>");
    stack.push(stack.length + 1);
  }
  while (stack.length > targetDepth) {
    stack.pop();
    out.push("</ul>");
  }
}

function structuralElementsToHtml(
  content: DocsStructuralElement[] | undefined,
  options: { listStack: number[]; plainTextLen: { n: number }; maxChars: number }
): string {
  if (!content?.length) return "";
  const { listStack, plainTextLen, maxChars } = options;
  const out: string[] = [];

  const stop = () => plainTextLen.n >= maxChars;

  for (const el of content) {
    if (stop()) break;

    if (el.table) {
      closeListStack(listStack, out);
      out.push(tableToHtml(el.table, options));
      continue;
    }

    if (el.paragraph) {
      const p = el.paragraph;
      const inner = renderParagraphElements(p.elements);
      const trimmed = inner.replace(/\u00a0/g, " ").trim();
      const hasBullet = Boolean(p.bullet?.listId);
      const level = Math.min(8, Math.max(0, p.bullet?.nestingLevel ?? 0));

      if (p.elements?.some((e) => e.horizontalRule)) {
        closeListStack(listStack, out);
        out.push(inner || "<hr>");
        continue;
      }

      if (hasBullet) {
        const depth = level + 1;
        ensureListDepth(listStack, depth, out);
        const li = trimmed || "<br>";
        plainTextLen.n += li.replace(/<[^>]+>/g, "").length;
        out.push(`<li>${li}</li>`);
        continue;
      }

      closeListStack(listStack, out);

      if (!trimmed && !inner.includes("<hr>")) {
        continue;
      }

      const tag = paragraphTag(p.paragraphStyle?.namedStyleType);
      plainTextLen.n += trimmed.replace(/<[^>]+>/g, "").length;
      out.push(`<${tag}>${inner || "<br>"}</${tag}>`);
    }
  }

  closeListStack(listStack, out);
  return out.join("");
}

function tableToHtml(table: DocsTable, options: { plainTextLen: { n: number }; maxChars: number }): string {
  const rows = table.tableRows ?? [];
  if (rows.length === 0) return "";
  const parts: string[] = ["<table><tbody>"];
  for (const row of rows) {
    if (options.plainTextLen.n >= options.maxChars) break;
    parts.push("<tr>");
    const cells = row.tableCells ?? [];
    for (const cell of cells) {
      const listStack: number[] = [];
      const inner = structuralElementsToHtml(cell.content, {
        listStack,
        plainTextLen: options.plainTextLen,
        maxChars: options.maxChars,
      });
      parts.push(`<td>${inner || "<p><br></p>"}</td>`);
    }
    parts.push("</tr>");
  }
  parts.push("</tbody></table>");
  return parts.join("");
}

/**
 * @param doc - Parsed JSON from GET https://docs.googleapis.com/v1/documents/{id}
 * @param maxChars - Stop adding content once approximate plain-text length exceeds this (HTML still valid).
 */
export function googleDocumentJsonToHtml(doc: DocsDocumentJson, maxChars: number): string {
  const listStack: number[] = [];
  const plainTextLen = { n: 0 };
  const body = structuralElementsToHtml(doc.body?.content, {
    listStack,
    plainTextLen,
    maxChars,
  });
  if (!body.trim()) {
    return "<p></p>";
  }
  return body;
}

export function sanitizeGoogleDocTitle(title: string | undefined): string {
  const t = (title ?? "").trim().replace(/\s+/g, " ");
  const cleaned = t.replace(/[<>:"/\\|?*\u0000-\u001F]+/g, " ").trim();
  return cleaned.slice(0, 500) || "Imported from Google Docs";
}
