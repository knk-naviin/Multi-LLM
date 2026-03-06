"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock, Cpu, Trophy, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { sharedMarkdownComponents } from "@/components/ui/MarkdownRenderer";
import { BRAND_GRADIENT } from "@/lib/brand";
import type { DebateStance } from "@/lib/types";
import { AGENT_COLORS, AGENT_LABELS, AgentAvatar, StanceBadge } from "./shared";

/* ─── Node data interface ─── */

export interface DebateNodeData {
  id: string;
  agent: string;
  agentName: string;
  role: string;
  content: string;
  stance: DebateStance;
  references: string[];
  sequence: number;
  totalAgents: number;
  responseTime?: number;
  tokens?: number;
  error?: string;
  isUser?: boolean;
  isSynthesis?: boolean;
  [key: string]: unknown;
}

/* ─── Truncation helper ─── */

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

/* ─── User Node ─── */

function UserNodeContent({ data }: { data: DebateNodeData }) {
  return (
    <div className="w-[220px]">
      <Handle type="source" position={Position.Bottom} className="!bg-[#6366f1] !w-2 !h-2" />
      <div
        className="rounded-xl px-3 py-2.5 text-white shadow-lg"
        style={{ background: BRAND_GRADIENT }}
      >
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider opacity-80">
          User Prompt
        </div>
        <div className="text-xs leading-relaxed">{truncate(data.content, 120)}</div>
      </div>
    </div>
  );
}

/* ─── Synthesis Node ─── */

function SynthesisNodeContent({ data }: { data: DebateNodeData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={expanded ? "w-[420px]" : "w-[240px]"} style={{ transition: "width 0.2s ease" }}>
      <Handle type="target" position={Position.Top} className="!bg-yellow-500 !w-2 !h-2" />
      <div
        className="rounded-xl border-2 border-yellow-500/30 bg-yellow-500/5 px-3 py-2.5 shadow-md cursor-pointer"
        style={{ background: "var(--surface)" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <Trophy size={13} className="text-yellow-500" />
          <span className="text-[11px] font-bold text-[var(--text-primary)]">Final Synthesis</span>
          <span className="ml-auto text-[var(--text-muted)]">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </div>
        {expanded ? (
          <div className="prose prose-xs max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-0.5 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>
              {data.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            {truncate(data.content, 120)}
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-[var(--text-soft)]">
          {data.responseTime != null && (
            <span className="flex items-center gap-0.5">
              <Clock size={8} />
              {data.responseTime}s
            </span>
          )}
          {data.tokens != null && data.tokens > 0 && (
            <span className="flex items-center gap-0.5">
              <Cpu size={8} />
              ~{data.tokens}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Agent Node ─── */

function AgentNodeContent({ data }: { data: DebateNodeData }) {
  const [expanded, setExpanded] = useState(false);
  const colors = AGENT_COLORS[data.agent] || AGENT_COLORS.gpt;

  if (data.error) {
    return (
      <div className="w-[220px]">
        <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: colors.text }} />
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: colors.text }} />
        <div
          className="rounded-xl px-3 py-2.5 shadow-md"
          style={{ background: "var(--surface)", border: `1px solid ${colors.border}` }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <AgentAvatar agent={data.agent} size={18} />
            <span className="text-[10px] font-semibold" style={{ color: colors.text }}>
              {data.agentName}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[10px] text-red-500">
            <AlertTriangle size={10} />
            {data.error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={expanded ? "w-[420px]" : "w-[220px]"} style={{ transition: "width 0.2s ease" }}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: colors.text }} />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: colors.text }} />
      <div
        className="rounded-xl px-3 py-2.5 shadow-md cursor-pointer"
        style={{ background: "var(--surface)", border: `1px solid ${colors.border}` }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Header */}
        <div className="mb-1.5 flex items-center gap-1.5 flex-wrap">
          <AgentAvatar agent={data.agent} size={18} />
          <span className="text-[10px] font-semibold" style={{ color: colors.text }}>
            {data.agentName}
          </span>
          <span className="text-[9px] text-[var(--text-soft)]">{data.role}</span>
          <span className="ml-auto text-[var(--text-muted)]">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </div>

        {/* Stance badge */}
        {data.stance && (
          <div className="mb-1.5">
            <StanceBadge stance={data.stance} />
          </div>
        )}

        {/* Content */}
        {expanded ? (
          <div className="prose prose-xs max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-0.5 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>
              {data.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            {truncate(data.content, 120)}
          </div>
        )}

        {/* Footer */}
        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-[var(--text-soft)]">
          {data.responseTime != null && (
            <span className="flex items-center gap-0.5">
              <Clock size={8} />
              {data.responseTime}s
            </span>
          )}
          {data.tokens != null && data.tokens > 0 && (
            <span className="flex items-center gap-0.5">
              <Cpu size={8} />
              ~{data.tokens}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Node Component ─── */

function DebateTreeNode({ data }: NodeProps) {
  const nodeData = data as unknown as DebateNodeData;

  if (nodeData.isUser) return <UserNodeContent data={nodeData} />;
  if (nodeData.isSynthesis) return <SynthesisNodeContent data={nodeData} />;
  return <AgentNodeContent data={nodeData} />;
}

export default memo(DebateTreeNode);
