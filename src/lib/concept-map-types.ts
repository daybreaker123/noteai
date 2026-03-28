import { z } from "zod";

export const conceptMapJsonSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string(),
        description: z.string(),
      })
    )
    .min(1)
    .max(24),
  edges: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      label: z.string(),
    })
  ),
});

export type ConceptMapData = z.infer<typeof conceptMapJsonSchema>;

export function stripJsonCodeFence(raw: string): string {
  let s = raw.trim();
  if (!s.startsWith("```")) return s;
  s = s.replace(/^```[a-zA-Z]*\s*\n?/, "");
  if (s.endsWith("```")) s = s.slice(0, -3).trimEnd();
  return s.trim();
}

export function parseConceptMapJson(raw: string): ConceptMapData | null {
  const stripped = stripJsonCodeFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  return parseConceptMapPayload(parsed);
}

/** Validate persisted or API `payload` objects (nodes + edges). */
export function parseConceptMapPayload(payload: unknown): ConceptMapData | null {
  const result = conceptMapJsonSchema.safeParse(payload);
  if (!result.success) return null;
  const data = result.data;
  const ids = new Set(data.nodes.map((n) => n.id));
  const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return { nodes: data.nodes, edges };
}

export function conceptMapToNotePlainText(sourceTitle: string, data: ConceptMapData): string {
  const lines: string[] = [
    `Concept map (from: ${sourceTitle})`,
    "",
    "Concepts",
    "",
  ];
  for (const n of data.nodes) {
    lines.push(`• ${n.label}: ${n.description}`);
  }
  lines.push("", "Relationships", "");
  for (const e of data.edges) {
    const from = data.nodes.find((x) => x.id === e.source)?.label ?? e.source;
    const to = data.nodes.find((x) => x.id === e.target)?.label ?? e.target;
    lines.push(`• ${from} → ${to} (${e.label})`);
  }
  return lines.join("\n");
}
