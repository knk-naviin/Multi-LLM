"use client";

import { useState, useEffect } from "react";
import { Layers, Play, X } from "lucide-react";

import { TaskChipSelector } from "@/components/chat/TaskChipSelector";
import { AgentRoleSelector } from "@/components/chat/AgentRoleSelector";
import { BRAND_GRADIENT } from "@/lib/brand";
import type { TaskTypeConfig } from "@/lib/types";

/* ─── Static task type definitions (no API call needed) ─── */
const TASK_TYPES: TaskTypeConfig[] = [
  {
    key: "coding",
    label: "Coding",
    icon: "Code",
    roles: [
      { key: "coder", label: "Coding Agent", description: "Writes the initial code" },
      { key: "reviewer", label: "Code Reviewer", description: "Reviews and suggests improvements" },
      { key: "qc", label: "QC Agent", description: "Checks bugs, performance, best practices" },
    ],
  },
  {
    key: "content_writing",
    label: "Content Writing",
    icon: "FileText",
    roles: [
      { key: "writer", label: "Writer Agent", description: "Writes the initial content" },
      { key: "editor", label: "Editor Agent", description: "Edits and improves content" },
      { key: "quality_reviewer", label: "Quality Reviewer", description: "Final quality review" },
    ],
  },
  {
    key: "story_building",
    label: "Story Building",
    icon: "BookOpen",
    roles: [
      { key: "story_creator", label: "Story Creator", description: "Creates the initial story" },
      { key: "plot_improver", label: "Plot Improver", description: "Improves plot and narrative" },
      { key: "style_editor", label: "Style Editor", description: "Polishes prose style" },
    ],
  },
  {
    key: "research",
    label: "Research",
    icon: "Search",
    roles: [
      { key: "researcher", label: "Research Agent", description: "Conducts thorough research" },
      { key: "fact_checker", label: "Fact Checker", description: "Verifies facts and claims" },
      { key: "summarizer", label: "Summary Agent", description: "Summarizes findings" },
    ],
  },
  {
    key: "data_analysis",
    label: "Data Analysis",
    icon: "BarChart",
    roles: [
      { key: "analyst", label: "Analysis Agent", description: "Analyzes the data" },
      { key: "validator", label: "Validation Agent", description: "Validates findings" },
      { key: "reporter", label: "Report Agent", description: "Creates a clear report" },
    ],
  },
  {
    key: "debugging",
    label: "Debugging",
    icon: "Bug",
    roles: [
      { key: "debugger", label: "Debug Agent", description: "Finds and identifies bugs" },
      { key: "fixer", label: "Fix Agent", description: "Proposes and implements fixes" },
      { key: "tester", label: "Test Agent", description: "Verifies fixes and suggests tests" },
    ],
  },
];

interface TaskModePanelProps {
  onSubmit: (taskType: string, agents: Record<string, string>, prompt: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

export function TaskModePanel({ onSubmit, onClose, disabled }: TaskModePanelProps) {
  const [taskPrompt, setTaskPrompt] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [agents, setAgents] = useState<Record<string, string>>({});

  const selectedConfig = TASK_TYPES.find((t) => t.key === selectedType);

  // Reset agent assignments when task type changes
  useEffect(() => {
    if (selectedConfig) {
      const defaults: Record<string, string> = {};
      const agentKeys = ["gpt", "gemini", "claude", "grok"];
      selectedConfig.roles.forEach((role, idx) => {
        defaults[role.key] = agentKeys[idx % agentKeys.length];
      });
      setAgents(defaults);
    } else {
      setAgents({});
    }
  }, [selectedType, selectedConfig]);

  const canSubmit =
    !disabled &&
    taskPrompt.trim().length > 0 &&
    selectedType !== null &&
    selectedConfig !== undefined;

  const handleSubmit = () => {
    if (!canSubmit || !selectedType) return;
    onSubmit(selectedType, agents, taskPrompt.trim());
    setTaskPrompt("");
  };

  return (
    <div className="animate-fade-in border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto max-w-4xl px-3 py-3 sm:px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md text-white"
              style={{ background: BRAND_GRADIENT }}
            >
              <Layers size={12} />
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Task Mode
            </span>
            <span className="text-[10px] text-[var(--text-soft)]">
              AI Team Workflow
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Task Description */}
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">
            Task Description
          </label>
          <textarea
            rows={2}
            value={taskPrompt}
            onChange={(e) => setTaskPrompt(e.target.value)}
            disabled={disabled}
            placeholder='e.g. "Build a REST API login system using Node.js and JWT authentication."'
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)] focus:border-[var(--text-soft)] transition-colors resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && canSubmit) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        {/* Task Type Chips */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
            Task Type
          </label>
          <TaskChipSelector
            taskTypes={TASK_TYPES}
            selected={selectedType}
            onSelect={setSelectedType}
            disabled={disabled}
          />
        </div>

        {/* Agent Role Assignment — shown when type selected */}
        {selectedConfig && (
          <div className="mb-3 animate-fade-in">
            <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
              Agent Assignment
            </label>
            <AgentRoleSelector
              roles={selectedConfig.roles}
              assignments={agents}
              onAssign={(roleKey, agentKey) =>
                setAgents((prev) => ({ ...prev, [roleKey]: agentKey }))
              }
              disabled={disabled}
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: canSubmit ? BRAND_GRADIENT : undefined }}
        >
          <Play size={14} />
          Submit Task
        </button>

        <p className="mt-1.5 text-center text-[10px] text-[var(--text-soft)]">
          Agents will run sequentially. This may take 30-60 seconds.
        </p>
      </div>
    </div>
  );
}
