"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";

import "@xyflow/react/dist/style.css";

import type { DebateMessage, DebateStance } from "@/lib/types";
import { AGENT_COLORS, STANCE_CONFIG } from "./shared";
import DebateTreeNode from "./DebateTreeNode";
import type { DebateNodeData } from "./DebateTreeNode";

/* ─── Node types registry ─── */

const nodeTypes = { debateNode: DebateTreeNode };

/* ─── Stance → edge style ─── */

const STANCE_EDGE_STYLES: Record<
  DebateStance,
  { stroke: string; strokeDasharray?: string; animated: boolean }
> = {
  initiate: { stroke: "#6366f1", animated: true },
  agree: { stroke: "#10b981", animated: false },
  oppose: { stroke: "#ef4444", strokeDasharray: "6 3", animated: false },
  partial_agree: { stroke: "#f59e0b", strokeDasharray: "3 3", animated: false },
  review: { stroke: "#8b5cf6", strokeDasharray: "3 3", animated: false },
};

/* ─── Node size estimates for dagre ─── */

const NODE_WIDTH = 240;
const NODE_HEIGHT = 120;
const SYNTH_WIDTH = 260;
const SYNTH_HEIGHT = 130;
const USER_WIDTH = 240;
const USER_HEIGHT = 80;

/* ─── Build tree data from messages ─── */

function buildTreeData(messages: DebateMessage[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Map agent names (from references) back to node IDs
  const agentNameToNodeId: Record<string, string> = {};
  // Map agent key to node id
  const agentKeyToNodeId: Record<string, string> = {};

  const userMsg = messages.find((m) => m.type === "user");
  const debateResponses = messages.filter((m) => m.type === "debate_response");
  const synthesisMsg = messages.find((m) => m.type === "synthesis");

  if (!userMsg) return { nodes, edges };

  // 1. User node (root)
  const userId = "node-user";
  nodes.push({
    id: userId,
    type: "debateNode",
    position: { x: 0, y: 0 },
    data: {
      id: userId,
      agent: "user",
      agentName: "User",
      role: "",
      content: userMsg.content,
      stance: "initiate" as DebateStance,
      references: [],
      sequence: 0,
      totalAgents: 0,
      isUser: true,
    } satisfies DebateNodeData,
  });

  // 2. Agent debate response nodes
  for (const msg of debateResponses) {
    const nodeId = `node-${msg.agent}-${msg.sequence || 0}`;
    const agentName = msg.agentName || msg.agent || "Agent";

    agentNameToNodeId[agentName] = nodeId;
    if (msg.agent) agentKeyToNodeId[msg.agent] = nodeId;

    nodes.push({
      id: nodeId,
      type: "debateNode",
      position: { x: 0, y: 0 },
      data: {
        id: nodeId,
        agent: msg.agent || "gpt",
        agentName,
        role: msg.agentRole || "",
        content: msg.content,
        stance: msg.stance || "review",
        references: msg.references || [],
        sequence: msg.sequence || 0,
        totalAgents: msg.totalAgents || 0,
        responseTime: msg.responseTime,
        tokens: msg.tokens,
        error: msg.error,
      } satisfies DebateNodeData,
    });

    // Create edges
    const stance = msg.stance || "review";
    const edgeStyle = STANCE_EDGE_STYLES[stance] || STANCE_EDGE_STYLES.review;

    if (msg.sequence === 1 || !msg.references || msg.references.length === 0) {
      // First agent: edge from user → this agent
      edges.push({
        id: `edge-user-${nodeId}`,
        source: userId,
        target: nodeId,
        animated: edgeStyle.animated,
        style: {
          stroke: edgeStyle.stroke,
          strokeWidth: 2,
          strokeDasharray: edgeStyle.strokeDasharray,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeStyle.stroke,
          width: 16,
          height: 16,
        },
      });
    } else if (msg.references && msg.references.length > 0) {
      // Subsequent agents: edges from referenced agents → this agent
      for (const refName of msg.references) {
        const sourceId = agentNameToNodeId[refName];
        if (sourceId) {
          edges.push({
            id: `edge-${sourceId}-${nodeId}`,
            source: sourceId,
            target: nodeId,
            animated: edgeStyle.animated,
            style: {
              stroke: edgeStyle.stroke,
              strokeWidth: 2,
              strokeDasharray: edgeStyle.strokeDasharray,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: edgeStyle.stroke,
              width: 16,
              height: 16,
            },
          });
        }
      }
    }
  }

  // 3. Synthesis node
  if (synthesisMsg) {
    const synthId = "node-synthesis";
    nodes.push({
      id: synthId,
      type: "debateNode",
      position: { x: 0, y: 0 },
      data: {
        id: synthId,
        agent: synthesisMsg.agent || "gpt",
        agentName: "Synthesis",
        role: "Final Answer",
        content: synthesisMsg.content,
        stance: "initiate" as DebateStance,
        references: [],
        sequence: 0,
        totalAgents: 0,
        responseTime: synthesisMsg.responseTime,
        tokens: synthesisMsg.tokens,
        error: synthesisMsg.error,
        isSynthesis: true,
      } satisfies DebateNodeData,
    });

    // Edges from all agent nodes → synthesis
    for (const msg of debateResponses) {
      const sourceId = agentKeyToNodeId[msg.agent || ""];
      if (sourceId) {
        edges.push({
          id: `edge-${sourceId}-synth`,
          source: sourceId,
          target: synthId,
          style: {
            stroke: "#eab308",
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#eab308",
            width: 16,
            height: 16,
          },
        });
      }
    }
  }

  // 4. Apply dagre layout
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const nd = node.data as DebateNodeData;
    const w = nd.isUser ? USER_WIDTH : nd.isSynthesis ? SYNTH_WIDTH : NODE_WIDTH;
    const h = nd.isUser ? USER_HEIGHT : nd.isSynthesis ? SYNTH_HEIGHT : NODE_HEIGHT;
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // Map positions back
  for (const node of nodes) {
    const pos = g.node(node.id);
    const nd = node.data as DebateNodeData;
    const w = nd.isUser ? USER_WIDTH : nd.isSynthesis ? SYNTH_WIDTH : NODE_WIDTH;
    const h = nd.isUser ? USER_HEIGHT : nd.isSynthesis ? SYNTH_HEIGHT : NODE_HEIGHT;
    node.position = {
      x: pos.x - w / 2,
      y: pos.y - h / 2,
    };
  }

  return { nodes, edges };
}

/* ─── Edge Legend ─── */

function EdgeLegend() {
  const items = [
    { label: "Initiates", color: "#6366f1", dash: false },
    { label: "Agrees", color: "#10b981", dash: false },
    { label: "Opposes", color: "#ef4444", dash: true },
    { label: "Partially Agrees", color: "#f59e0b", dash: true },
    { label: "Reviewing", color: "#8b5cf6", dash: true },
    { label: "Synthesis", color: "#eab308", dash: false },
  ];

  return (
    <div
      className="absolute bottom-3 left-3 z-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-md"
    >
      <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">
        Edge Legend
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <svg width="24" height="8" className="shrink-0">
              <line
                x1="0"
                y1="4"
                x2="24"
                y2="4"
                stroke={item.color}
                strokeWidth="2"
                strokeDasharray={item.dash ? "4 2" : undefined}
              />
            </svg>
            <span className="text-[10px] text-[var(--text-muted)]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

interface DebateTreeViewProps {
  messages: DebateMessage[];
}

export default function DebateTreeView({ messages }: DebateTreeViewProps) {
  const { nodes, edges } = useMemo(() => buildTreeData(messages), [messages]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
        No debate data to visualize yet.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const nd = node.data as DebateNodeData;
            if (nd.isUser) return "#6366f1";
            if (nd.isSynthesis) return "#eab308";
            return AGENT_COLORS[nd.agent]?.text || "#888";
          }}
          maskColor="rgba(0,0,0,0.15)"
        />
      </ReactFlow>
      <EdgeLegend />
    </div>
  );
}
