"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { DriverImpact, GraphEdge, GraphNode } from "@/lib/api";

const NODE_W = 180;
const NODE_H = 46;
const COL_GAP = 72;
const ROW_GAP = 14;

type NodeState = "idle" | "dim" | "lit" | "source" | "focus";
type DriverData = { label: string; theme: string; state: NodeState; impact?: DriverImpact };
type Pos = Record<string, { x: number; y: number }>;

const ORDER = ["Source", "Direct effect", "2nd order", "3rd order", "4th order"];

const elk = new ELK();

// React Flow reads its theme from CSS variables on the wrapper
const FLOW_VARS = {
  "--xy-background-color": "var(--ground)",
  "--xy-edge-label-background-color": "var(--panel)",
  "--xy-edge-label-color": "var(--ink)",
  "--xy-controls-button-background-color": "var(--panel)",
  "--xy-controls-button-background-color-hover": "var(--panel-2)",
  "--xy-controls-button-border-color": "var(--line)",
  "--xy-controls-button-color": "var(--ink)",
} as CSSProperties;

async function layout(nodes: GraphNode[], edges: GraphEdge[]) {
  const res = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
      "elk.spacing.nodeNode": "18",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    },
    children: nodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
    edges: edges.map((e, i) => ({ id: `e${i}`, sources: [e.source], targets: [e.target] })),
  });
  return Object.fromEntries((res.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
}

// one column per hop, each child kept next to the parent its signal came through
function hopLayout(sources: string[], impacts: Map<string, DriverImpact>) {
  const cols: string[][] = [];
  const hop = (id: string) => (sources.includes(id) ? 0 : impacts.get(id)?.hops ?? 0);
  for (const id of new Set([...sources, ...impacts.keys()])) (cols[hop(id)] ??= []).push(id);
  const rank: Record<string, number> = {};
  const parentRank = (id: string) => {
    const p = impacts.get(id)?.path;
    return p && p.length > 1 ? rank[p[p.length - 2]] ?? 1e6 : 0;
  };
  const pos: Pos = {};
  let top = 0;
  cols.forEach((col = [], c) => {
    col.sort((a, b) => parentRank(a) - parentRank(b) || (impacts.get(b)?.impact ?? 0) - (impacts.get(a)?.impact ?? 0));
    col.forEach((id, i) => {
      rank[id] = i;
      const y = (i - (col.length - 1) / 2) * (NODE_H + ROW_GAP);
      pos[id] = { x: c * (NODE_W + COL_GAP), y };
      top = Math.min(top, y);
    });
  });
  const headers = cols.map((col, c) => (col?.length ? { id: `col-${c}`, label: ORDER[c] ?? `${c} hops`, x: c * (NODE_W + COL_GAP), y: top - 40 } : null));
  return { pos, headers: headers.filter((h) => h !== null) };
}

function ColumnLabel({ data }: NodeProps<Node<{ label: string }>>) {
  return <div className="w-[180px] border-b border-line pb-1 text-[12px] text-muted">{data.label}</div>;
}

function DriverNode({ data }: NodeProps<Node<DriverData>>) {
  const { state, impact } = data;
  const dir = impact?.direction ?? 0;
  return (
    <div
      className={[
        "relative flex h-[46px] w-[180px] items-center gap-2 rounded-md border px-2.5 text-[13px] leading-tight transition-all duration-500",
        state === "idle" && "border-line bg-panel text-ink",
        state === "dim" && "border-line/60 bg-panel/60 text-muted opacity-40",
        state === "lit" && "border-signal/70 bg-signal-soft text-ink",
        state === "focus" && "border-signal bg-signal-soft text-ink shadow-[0_0_0_3px_var(--signal-soft)]",
        state === "source" && "border-signal bg-signal text-[#1a1406] font-semibold",
      ]
        .filter(Boolean)
        .join(" ")}
      title={data.label}
    >
      {state === "source" && (
        <span aria-hidden>
          <span className="ripple-ring" />
          <span className="ripple-ring" />
          <span className="ripple-ring" />
        </span>
      )}
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-line" />
      <span className="line-clamp-2 min-w-0 flex-1">{data.label}</span>
      {impact && state !== "source" && (
        <span className={`shrink-0 font-mono text-[11px] ${dir > 0 ? "text-up" : dir < 0 ? "text-down" : "text-muted"}`}>
          {dir > 0 ? "▲" : dir < 0 ? "▼" : "•"}
          {impact.impact.toFixed(2)}
        </span>
      )}
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-line" />
    </div>
  );
}

const nodeTypes = { driver: DriverNode, column: ColumnLabel };

export type RippleState = {
  sources: string[];
  impacts: Map<string, DriverImpact>;
  revealed: Set<string>;
  focusPath: string[] | null;
};

type Props = { graph: { nodes: GraphNode[]; edges: GraphEdge[] }; ripple: RippleState | null; theme: "dark" | "light" };

function Canvas({ graph, ripple, theme }: Props) {
  const [fullPos, setFullPos] = useState<Pos | null>(null);
  const { fitView } = useReactFlow();

  useEffect(() => {
    let live = true;
    layout(graph.nodes, graph.edges).then((p) => live && setFullPos(p));
    return () => {
      live = false;
    };
  }, [graph]);

  const reachedKey = ripple ? [...ripple.impacts.keys()].sort().join() : "";
  const visible = useMemo(() => {
    if (!ripple) return graph;
    const ids = new Set([...ripple.sources, ...ripple.impacts.keys()]);
    return {
      nodes: graph.nodes.filter((n) => ids.has(n.id)),
      edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    };
  }, [graph, reachedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const hops = useMemo(
    () => (ripple ? hopLayout(ripple.sources, ripple.impacts) : null),
    [reachedKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const pos = hops?.pos ?? fullPos;

  const pathEdges = useMemo(() => {
    const s = new Set<string>();
    if (!ripple) return s;
    for (const imp of ripple.impacts.values())
      for (let i = 1; i < imp.path.length; i++) s.add(`${imp.path[i - 1]}>${imp.path[i]}`);
    return s;
  }, [ripple]);

  const focusEdges = useMemo(() => {
    const s = new Set<string>();
    const p = ripple?.focusPath;
    if (p) for (let i = 1; i < p.length; i++) s.add(`${p[i - 1]}>${p[i]}`);
    return s;
  }, [ripple]);

  const nodes: Node[] = useMemo(() => {
    if (!pos) return [];
    const drivers: Node<DriverData>[] = visible.nodes.filter((n) => pos[n.id]).map((n) => {
      let state: NodeState = "idle";
      if (ripple) {
        if (ripple.sources.includes(n.id)) state = "source";
        else if (ripple.focusPath?.includes(n.id)) state = "focus";
        else if (ripple.revealed.has(n.id)) state = "lit";
        else state = "dim";
      }
      return {
        id: n.id,
        type: "driver",
        position: pos[n.id] ?? { x: 0, y: 0 },
        data: { label: n.name, theme: n.theme, state, impact: ripple?.revealed.has(n.id) ? ripple.impacts.get(n.id) : undefined },
        draggable: false,
        width: NODE_W,
        height: NODE_H,
        measured: { width: NODE_W, height: NODE_H },
      };
    });
    const headers: Node[] = (hops?.headers ?? []).map((h) => ({
      id: h.id,
      type: "column",
      position: { x: h.x, y: h.y },
      data: { label: h.label },
      draggable: false,
      selectable: false,
      width: NODE_W,
      height: 24,
      measured: { width: NODE_W, height: 24 },
    }));
    return [...headers, ...drivers];
  }, [visible, pos, ripple, hops]);

  const edges: Edge[] = useMemo(
    () =>
      visible.edges.map((e) => {
        const key = `${e.source}>${e.target}`;
        const onPath = pathEdges.has(key) && ripple?.revealed.has(e.target);
        const focus = focusEdges.has(key);
        const color = focus || onPath ? "var(--signal)" : "var(--line)";
        return {
          id: key,
          source: e.source,
          target: e.target,
          animated: Boolean(focus),
          style: {
            stroke: color,
            strokeWidth: focus ? 3 : onPath ? 2 : 1,
            opacity: ripple && !onPath && !focus ? 0.12 : 1,
            strokeDasharray: e.polarity < 0 ? "5 4" : undefined,
          },
          label: focus ? `${e.weight.toFixed(2)} · ${e.lag_months}mo` : undefined,
          labelStyle: { fill: "var(--ink)", fontSize: 11 },
          labelBgStyle: { fill: "var(--panel)" },
        };
      }),
    [visible, pathEdges, focusEdges, ripple],
  );

  useEffect(() => {
    if (!pos) return;
    const t = setTimeout(() => fitView({ duration: 500, padding: 0.08, maxZoom: 1.2 }), 80);
    return () => clearTimeout(t);
  }, [pos, nodes.length, fitView]);

  if (!pos) return <div className="grid h-full place-items-center text-muted">Laying out the graph…</div>;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.2}
      nodesConnectable={false}
      colorMode={theme}
      style={FLOW_VARS}
    >
      <Background color="var(--line)" gap={28} size={1} />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

export function RippleGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
