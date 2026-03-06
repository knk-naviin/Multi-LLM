"use client";

import type { TaskRole } from "@/lib/types";

const AGENT_OPTIONS = [
  { value: "gpt", label: "GPT", color: "#10a37f" },
  { value: "gemini", label: "Gemini", color: "#4285f4" },
  { value: "claude", label: "Claude", color: "#d97706" },
  { value: "grok", label: "Grok", color: "#ef4444" },
];

interface AgentRoleSelectorProps {
  roles: TaskRole[];
  assignments: Record<string, string>;
  onAssign: (roleKey: string, agentKey: string) => void;
  disabled?: boolean;
}

export function AgentRoleSelector({
  roles,
  assignments,
  onAssign,
  disabled,
}: AgentRoleSelectorProps) {
  return (
    <div className="space-y-2">
      {roles.map((role, idx) => {
        const selectedAgent = assignments[role.key] || "gpt";
        const agentColor =
          AGENT_OPTIONS.find((a) => a.value === selectedAgent)?.color || "#6b7280";

        return (
          <div
            key={role.key}
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
          >
            {/* Step number */}
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: agentColor }}
            >
              {idx + 1}
            </div>

            {/* Role info */}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                {role.label}
              </div>
              <div className="text-[10px] text-[var(--text-soft)] truncate">
                {role.description}
              </div>
            </div>

            {/* Agent dropdown */}
            <select
              value={selectedAgent}
              onChange={(e) => onAssign(role.key, e.target.value)}
              disabled={disabled}
              className="h-7 appearance-none rounded-md border border-[var(--border)] bg-[var(--background)] px-2 pr-6 text-xs font-medium text-[var(--text-secondary)] outline-none hover:border-[var(--text-soft)] disabled:opacity-50"
              style={{ borderColor: agentColor + "40" }}
            >
              {AGENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
