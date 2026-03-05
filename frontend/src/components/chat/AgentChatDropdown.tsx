"use client";

import { useState } from "react";
import { ChevronDown, Clock, Cpu, MessageSquare } from "lucide-react";
import type { AgentChatMessage } from "@/lib/types";

/* Agent color map — matches backend AGENT_DEFINITIONS */
const AGENT_COLORS: Record<string, string> = {
  gpt: "#10a37f",
  gemini: "#4285f4",
  claude: "#d97706",
  grok: "#ef4444",
};

interface AgentChatDropdownProps {
  agentChat: AgentChatMessage[];
  synthesizedBy?: string;
  responseTime?: number;
}

function AgentAvatar({ agent, size = 24 }: { agent: string; size?: number }) {
  const color = AGENT_COLORS[agent] || "#6b7280";
  const initials = (agent || "?").slice(0, 2).toUpperCase();

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-white font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}

function AgentMessage({ msg }: { msg: AgentChatMessage }) {
  const color = AGENT_COLORS[msg.agent] || "#6b7280";
  const hasError = !!msg.error;

  return (
    <div className="agent-chat-msg animate-fade-in flex gap-2.5 py-2.5">
      <AgentAvatar agent={msg.agent} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold" style={{ color }}>
            {msg.name}
          </span>
          <span className="text-[10px] text-[var(--text-soft)]">{msg.role}</span>
        </div>
        <div
          className={`text-[13px] leading-relaxed ${
            hasError ? "text-red-400 italic" : "text-[var(--text-secondary)]"
          }`}
        >
          {msg.message.length > 300
            ? msg.message.slice(0, 300) + "..."
            : msg.message}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--text-soft)]">
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {msg.response_time.toFixed(1)}s
          </span>
          {msg.tokens > 0 && (
            <span className="flex items-center gap-1">
              <Cpu size={9} />
              ~{msg.tokens} tokens
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentChatDropdown({
  agentChat,
  synthesizedBy,
  responseTime,
}: AgentChatDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!agentChat || agentChat.length === 0) return null;

  const validAgents = agentChat.filter((a) => !a.error);

  return (
    <div className="mt-2">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-all hover:bg-[var(--surface-alt)] hover:text-[var(--text-secondary)]"
      >
        <MessageSquare size={12} className="text-amber-500" />
        <span>AI Agent Chat</span>
        <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
          {validAgents.length} agents
        </span>
        {responseTime != null && (
          <span className="text-[10px] text-[var(--text-soft)]">
            {responseTime.toFixed(1)}s
          </span>
        )}
        <ChevronDown
          size={12}
          className={`ml-auto transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown content */}
      <div
        className={`agent-chat-dropdown overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[2000px] opacity-100 mt-1" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-1">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              Agent Discussion
            </span>
            {synthesizedBy && (
              <span className="text-[10px] text-[var(--text-soft)]">
                Synthesized by{" "}
                <span className="font-medium" style={{ color: AGENT_COLORS[synthesizedBy] || "inherit" }}>
                  {synthesizedBy.toUpperCase()}
                </span>
              </span>
            )}
          </div>

          {/* Agent messages */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {agentChat.map((msg, idx) => (
              <AgentMessage key={`${msg.agent}-${idx}`} msg={msg} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
