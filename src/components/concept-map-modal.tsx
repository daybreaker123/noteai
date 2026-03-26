"use client";

import * as React from "react";
import { toPng } from "html-to-image";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X, ZoomIn, ZoomOut, Maximize2, ImageDown, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useStudaraTheme } from "@/components/theme-provider";
import type { ConceptMapData } from "@/lib/concept-map-types";

type ConceptNodeData = { label: string; description: string };

function ConceptMapNode({ data }: NodeProps) {
  const d = data as ConceptNodeData;
  const label = d.label;
  const description = d.description;
  return (
    <div className="w-[min(200px,42vw)] rounded-xl border-2 border-purple-500/45 bg-[var(--surface-mid)] px-3 py-3 text-center shadow-lg shadow-black/40">
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-purple-400/90" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-purple-400/90" />
      <p className="text-sm font-semibold leading-snug text-[var(--text)]">{label}</p>
      {description ? <p className="mt-1.5 text-center text-xs leading-snug text-[var(--muted)]">{description}</p> : null}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-purple-400/90" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-purple-400/90" />
    </div>
  );
}

const nodeTypes: NodeTypes = { concept: ConceptMapNode };

function buildFlowElements(data: ConceptMapData, edgeLabelBg: string): { nodes: Node[]; edges: Edge[] } {
  const n = data.nodes.length;
  const cx = 480;
  const cy = 340;
  const radius = Math.max(240, 72 * Math.sqrt(n));
  const nodes: Node[] = data.nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
    return {
      id: node.id,
      type: "concept",
      position: {
        x: cx + radius * Math.cos(angle) - 100,
        y: cy + radius * Math.sin(angle) - 48,
      },
      data: { label: node.label, description: node.description },
    };
  });
  const edges: Edge[] = data.edges.map((e, i) => ({
    id: `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    style: { stroke: "rgba(148, 163, 184, 0.45)", strokeWidth: 1.25 },
    labelStyle: { fill: "#94a3b8", fontSize: 11, fontWeight: 500 },
    labelBgStyle: { fill: edgeLabelBg, fillOpacity: 0.95 },
    labelBgPadding: [6, 4] as [number, number],
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "rgba(148, 163, 184, 0.5)",
      width: 12,
      height: 12,
    },
  }));
  return { nodes, edges };
}

function ConceptMapCanvas({
  graph,
  flowWrapRef,
  onClose,
  sourceTitle,
  onSaveAsNote,
  saveNoteLoading,
}: {
  graph: ConceptMapData;
  flowWrapRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  sourceTitle: string;
  onSaveAsNote: () => void | Promise<void>;
  saveNoteLoading: boolean;
}) {
  const { theme } = useStudaraTheme();
  const edgeLabelBg = theme === "light" ? "#ffffff" : "#12121a";
  const initial = React.useMemo(() => buildFlowElements(graph, edgeLabelBg), [graph, edgeLabelBg]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [initial, setNodes, setEdges]);

  React.useEffect(() => {
    const t = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 200 });
    });
    return () => cancelAnimationFrame(t);
  }, [fitView, initial]);

  async function handleSavePng() {
    const el = flowWrapRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const rootBg =
        typeof document !== "undefined"
          ? getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0a0a0f"
          : "#0a0a0f";
      const dataUrl = await toPng(el, {
        backgroundColor: rootBg,
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `studara-concept-map-${Date.now()}.png`;
      a.click();
    } catch {
      /* ignore */
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--modal-surface)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-[var(--text)]">Concept map</h2>
          <p className="truncate text-xs text-[var(--muted)]">From: {sourceTitle || "Untitled"}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
            disabled={exporting}
            onClick={() => void handleSavePng()}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />}
            Save as Image
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
            disabled={saveNoteLoading}
            onClick={() => void onSaveAsNote()}
          >
            {saveNoteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Save as Note
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--btn-default-bg)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div ref={flowWrapRef} className="min-h-0 flex-1 bg-[var(--bg)]" data-concept-map-canvas>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.15}
          maxZoom={1.8}
          proOptions={{ hideAttribution: true }}
          className="!bg-[var(--bg)]"
        >
          <Background color="rgba(139, 92, 246, 0.12)" gap={22} size={1} />
          <Controls
            className="!m-3 !overflow-hidden !rounded-xl !border !border-[var(--border)] !bg-[var(--surface-mid)] !shadow-lg [&_button]:!h-8 [&_button]:!w-8 [&_button]:!border-[var(--border)] [&_button]:!bg-transparent [&_button]:!fill-[var(--muted)] [&_button:hover]:!bg-[var(--btn-default-bg)]"
            showInteractive={false}
          />
          <Panel position="top-left" className="!m-3 mt-14 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="border border-[var(--border)] bg-[var(--surface-mid)] text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
              onClick={() => zoomIn({ duration: 200 })}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="border border-[var(--border)] bg-[var(--surface-mid)] text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
              onClick={() => zoomOut({ duration: 200 })}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="border border-[var(--border)] bg-[var(--surface-mid)] text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
              onClick={() => fitView({ padding: 0.2, duration: 250 })}
            >
              <Maximize2 className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Fit</span>
            </Button>
          </Panel>
        </ReactFlow>
      </div>
    </>
  );
}

export function ConceptMapModal({
  open,
  onClose,
  graph,
  sourceTitle,
  onSaveAsNote,
  saveNoteLoading,
}: {
  open: boolean;
  onClose: () => void;
  graph: ConceptMapData | null;
  sourceTitle: string;
  onSaveAsNote: (data: ConceptMapData) => void | Promise<void>;
  saveNoteLoading: boolean;
}) {
  const flowWrapRef = React.useRef<HTMLDivElement>(null);

  if (!open || !graph) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-[var(--bg)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="concept-map-title"
    >
      <span id="concept-map-title" className="sr-only">
        Concept map
      </span>
      <ReactFlowProvider>
        <ConceptMapCanvas
          graph={graph}
          flowWrapRef={flowWrapRef}
          onClose={onClose}
          sourceTitle={sourceTitle}
          saveNoteLoading={saveNoteLoading}
          onSaveAsNote={() => void onSaveAsNote(graph)}
        />
      </ReactFlowProvider>
    </div>
  );
}
