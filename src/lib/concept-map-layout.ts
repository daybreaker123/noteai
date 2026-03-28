import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { ConceptMapData } from "@/lib/concept-map-types";

export type ConceptTier = "root" | "primary" | "secondary";

export type ConceptNodeFlowData = { label: string; description: string; tier: ConceptTier };

/** Must match rendered node boxes for correct Dagre spacing. */
export const CONCEPT_NODE_DIM: Record<ConceptTier, { width: number; height: number }> = {
  root: { width: 272, height: 108 },
  primary: { width: 228, height: 94 },
  secondary: { width: 188, height: 82 },
};

function pickRootId(data: ConceptMapData): string {
  const inD = new Map(data.nodes.map((n) => [n.id, 0]));
  const outD = new Map(data.nodes.map((n) => [n.id, 0]));
  for (const e of data.edges) {
    if (e.source === e.target) continue;
    outD.set(e.source, (outD.get(e.source) ?? 0) + 1);
    inD.set(e.target, (inD.get(e.target) ?? 0) + 1);
  }
  const noIn = data.nodes.filter((n) => (inD.get(n.id) ?? 0) === 0);
  if (noIn.length === 1) return noIn[0]!.id;
  if (noIn.length > 1) {
    return [...noIn].sort((a, b) => (outD.get(b.id) ?? 0) - (outD.get(a.id) ?? 0))[0]!.id;
  }
  return [...data.nodes].sort(
    (a, b) => outD.get(b.id)! - inD.get(b.id)! - (outD.get(a.id)! - inD.get(a.id)!)
  )[0]!.id;
}

/** Undirected BFS depth from root → mind-map tiers. */
function bfsDepthFromRoot(data: ConceptMapData, rootId: string): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const n of data.nodes) adj.set(n.id, []);
  for (const e of data.edges) {
    if (e.source === e.target) continue;
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }
  const depth = new Map<string, number>();
  const q: string[] = [rootId];
  depth.set(rootId, 0);
  let qi = 0;
  while (qi < q.length) {
    const u = q[qi++]!;
    const du = depth.get(u)!;
    for (const v of adj.get(u) ?? []) {
      if (!depth.has(v)) {
        depth.set(v, du + 1);
        q.push(v);
      }
    }
  }
  let maxD = 0;
  for (const d of depth.values()) maxD = Math.max(maxD, d);
  for (const n of data.nodes) {
    if (!depth.has(n.id)) depth.set(n.id, maxD + 1);
  }
  return depth;
}

function tierForDepth(depth: number): ConceptTier {
  if (depth <= 0) return "root";
  if (depth === 1) return "primary";
  return "secondary";
}

function orientEdgeForDagre(
  e: ConceptMapData["edges"][number],
  depth: Map<string, number>
): { v: string; w: string } | null {
  if (e.source === e.target) return null;
  const ds = depth.get(e.source) ?? 9999;
  const dt = depth.get(e.target) ?? 9999;
  if (ds < dt) return { v: e.source, w: e.target };
  if (dt < ds) return { v: e.target, w: e.source };
  return e.source.localeCompare(e.target) <= 0
    ? { v: e.source, w: e.target }
    : { v: e.target, w: e.source };
}

export function buildConceptMapFlowElements(
  data: ConceptMapData,
  edgeLabelBg: string
): { nodes: Node<ConceptNodeFlowData>[]; edges: Edge[] } {
  const rootId = pickRootId(data);
  const depth = bfsDepthFromRoot(data, rootId);

  const tiers = new Map<string, ConceptTier>();
  for (const n of data.nodes) {
    const d = n.id === rootId ? 0 : depth.get(n.id) ?? 2;
    tiers.set(n.id, tierForDepth(d));
  }
  tiers.set(rootId, "root");

  const g = new dagre.graphlib.Graph({ multigraph: false, compound: false });
  g.setGraph({
    rankdir: "TB",
    align: "UL",
    nodesep: 52,
    ranksep: 96,
    marginx: 56,
    marginy: 56,
    edgesep: 16,
    ranker: "tight-tree",
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of data.nodes) {
    const tier = tiers.get(n.id)!;
    const dim = CONCEPT_NODE_DIM[tier];
    g.setNode(n.id, { width: dim.width, height: dim.height });
  }

  const seenDirected = new Set<string>();
  for (const e of data.edges) {
    const o = orientEdgeForDagre(e, depth);
    if (!o) continue;
    const key = `${o.v}\0${o.w}`;
    if (seenDirected.has(key)) continue;
    if (!g.hasNode(o.v) || !g.hasNode(o.w)) continue;
    seenDirected.add(key);
    g.setEdge(o.v, o.w);
  }

  dagre.layout(g);

  const nodes: Node<ConceptNodeFlowData>[] = data.nodes.map((n) => {
    const tier = tiers.get(n.id)!;
    const dim = CONCEPT_NODE_DIM[tier];
    const layoutNode = g.node(n.id);
    const cx = typeof layoutNode?.x === "number" ? layoutNode.x : 0;
    const cy = typeof layoutNode?.y === "number" ? layoutNode.y : 0;
    return {
      id: n.id,
      type: "concept",
      position: {
        x: cx - dim.width / 2,
        y: cy - dim.height / 2,
      },
      data: {
        label: n.label,
        description: n.description,
        tier,
      },
    };
  });

  const edges: Edge[] = data.edges.map((e, i) => ({
    id: `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    style: { stroke: "rgba(139, 92, 246, 0.38)", strokeWidth: 1.35 },
    labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
    labelBgStyle: { fill: edgeLabelBg, fillOpacity: 0.95 },
    labelBgPadding: [6, 4] as [number, number],
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "rgba(139, 92, 246, 0.45)",
      width: 12,
      height: 12,
    },
  }));

  return { nodes, edges };
}
