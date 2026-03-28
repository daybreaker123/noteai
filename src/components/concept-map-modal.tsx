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
} from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X, ZoomIn, ZoomOut, Maximize2, ImageDown, FileText, Loader2, Bookmark } from "lucide-react";
import { Button } from "@/components/ui";
import { useStudaraTheme } from "@/components/theme-provider";
import type { ConceptMapData } from "@/lib/concept-map-types";
import {
  buildConceptMapFlowElements,
  type ConceptNodeFlowData,
} from "@/lib/concept-map-layout";

function ConceptMapNode({ data }: NodeProps<Node<ConceptNodeFlowData>>) {
  const { label, description, tier } = data;
  const box =
    tier === "root"
      ? "w-[272px] min-h-[100px] rounded-2xl border-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-4 py-3.5 text-center shadow-[var(--concept-map-root-shadow)] ring-1 ring-[var(--concept-map-root-ring)]"
      : tier === "primary"
        ? "w-[228px] min-h-[86px] rounded-xl border-2 border-[var(--concept-map-node-border-strong)] bg-[var(--surface-mid)] px-3.5 py-3 text-center shadow-[0_10px_28px_-8px_var(--shadow-node)]"
        : "w-[188px] min-h-[76px] rounded-lg border border-[var(--concept-map-node-border)] bg-[var(--surface-mid)] px-3 py-2.5 text-center shadow-[0_6px_18px_-6px_var(--shadow-node)]";
  const titleClass =
    tier === "root"
      ? "text-base font-bold leading-snug text-[var(--inverse-text)]"
      : tier === "primary"
        ? "text-sm font-semibold leading-snug text-[var(--text)]"
        : "text-xs font-semibold leading-snug text-[var(--text)]";
  const descClass =
    tier === "root"
      ? "mt-1.5 text-center text-xs leading-snug text-[color-mix(in_oklab,var(--inverse-text)_85%,transparent)]"
      : tier === "primary"
        ? "mt-1.5 text-center text-[11px] leading-snug text-[var(--muted)]"
        : "mt-1 text-center text-[10px] leading-snug text-[var(--muted)]";
  const handleClass =
    tier === "root"
      ? "!h-2.5 !w-2.5 !border-0 !bg-[var(--concept-map-handle-root)]"
      : "!h-2 !w-2 !border-0 !bg-[var(--concept-map-handle)]";
  return (
    <div className={box}>
      <Handle type="target" position={Position.Top} className={handleClass} />
      <p className={titleClass}>{label}</p>
      {description ? <p className={descClass}>{description}</p> : null}
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </div>
  );
}

const nodeTypes: NodeTypes = { concept: ConceptMapNode };

function ConceptMapCanvas({
  graph,
  flowWrapRef,
  onClose,
  sourceTitle,
  onSaveAsNote,
  saveNoteLoading,
  showSaveAsNote,
  onSaveToStudySets,
  saveStudySetsLoading,
  showSaveToStudySets,
}: {
  graph: ConceptMapData;
  flowWrapRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  sourceTitle: string;
  onSaveAsNote: () => void | Promise<void>;
  saveNoteLoading: boolean;
  showSaveAsNote: boolean;
  onSaveToStudySets: () => void | Promise<void>;
  saveStudySetsLoading: boolean;
  showSaveToStudySets: boolean;
}) {
  const { theme } = useStudaraTheme();
  const edgeLabelBg = theme === "light" ? "#ffffff" : "#12121a";
  const initial = React.useMemo(() => buildConceptMapFlowElements(graph, edgeLabelBg), [graph, edgeLabelBg]);
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
          {showSaveToStudySets ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--btn-default-bg)]"
              disabled={saveStudySetsLoading}
              onClick={() => void onSaveToStudySets()}
            >
              {saveStudySetsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
              Save Concept Map
            </Button>
          ) : null}
          {showSaveAsNote ? (
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
          ) : null}
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
  showSaveAsNote = true,
  onSaveToStudySets,
  saveStudySetsLoading,
  showSaveToStudySets = true,
}: {
  open: boolean;
  onClose: () => void;
  graph: ConceptMapData | null;
  sourceTitle: string;
  onSaveAsNote: (data: ConceptMapData) => void | Promise<void>;
  saveNoteLoading: boolean;
  /** Hide when there is no open note context (e.g. map opened from Study Sets). */
  showSaveAsNote?: boolean;
  onSaveToStudySets: (data: ConceptMapData) => void | Promise<void>;
  saveStudySetsLoading: boolean;
  /** False when the map is already a saved study set. */
  showSaveToStudySets?: boolean;
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
          showSaveAsNote={showSaveAsNote}
          onSaveAsNote={() => void onSaveAsNote(graph)}
          saveStudySetsLoading={saveStudySetsLoading}
          showSaveToStudySets={showSaveToStudySets}
          onSaveToStudySets={() => void onSaveToStudySets(graph)}
        />
      </ReactFlowProvider>
    </div>
  );
}
