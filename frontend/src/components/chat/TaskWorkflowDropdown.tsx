"use client";

import { useState } from "react";
import { ChevronDown, Clock, Cpu, Workflow } from "lucide-react";
import type { WorkflowStepMessage } from "@/lib/types";

const AGENT_COLORS: Record<string, string> = {
  gpt: "#10a37f",
  gemini: "#4285f4",
  claude: "#d97706",
  grok: "#ef4444",
};

interface TaskWorkflowDropdownProps {
  workflowChat: WorkflowStepMessage[];
  taskType?: string;
  responseTime?: number;
}

function StepAvatar({ agent, step }: { agent: string; step: number }) {
  const color = AGENT_COLORS[agent] || "#6b7280";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-white font-bold"
      style={{ width: 28, height: 28, backgroundColor: color, fontSize: 11 }}
    >
      #{step}
    </div>
  );
}

function WorkflowStep({ msg, step }: { msg: WorkflowStepMessage; step: number }) {
  const color = AGENT_COLORS[msg.agent] || "#6b7280";
  const hasError = !!msg.error;

  return (
    <div className="agent-chat-msg animate-fade-in flex gap-2.5 py-2.5">
      <StepAvatar agent={msg.agent} step={step} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-xs font-semibold" style={{ color }}>
            {msg.role_label}
          </span>
          <span className="text-[10px] text-[var(--text-soft)]">
            via {msg.agent_name}
          </span>
        </div>
        <div
          className={`text-[13px] leading-relaxed ${
            hasError ? "text-red-400 italic" : "text-[var(--text-secondary)]"
          }`}
        >
          {msg.message.length > 400
            ? msg.message.slice(0, 400) + "..."
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

export function TaskWorkflowDropdown({
  workflowChat,
  taskType,
  responseTime,
}: TaskWorkflowDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!workflowChat || workflowChat.length === 0) return null;

  const validSteps = workflowChat.filter((s) => !s.error);

  return (
    <div className="mt-2">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-all hover:bg-[var(--surface-alt)] hover:text-[var(--text-secondary)]"
      >
        <Workflow size={12} className="text-[var(--brand)]" />
        <span>Task Workflow Chat</span>
        <span className="rounded-full bg-[var(--brand-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--brand-text)]">
          {validSteps.length} steps
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
              Workflow Pipeline
            </span>
            {taskType && (
              <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)] capitalize">
                {taskType.replace("_", " ")}
              </span>
            )}
          </div>

          {/* Workflow steps */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {workflowChat.map((msg, idx) => (
              <WorkflowStep
                key={`${msg.role_key}-${idx}`}
                msg={msg}
                step={idx + 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
