"use client";

import { Sparkles } from "lucide-react";

interface BestAnswerToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

export function BestAnswerToggle({ enabled, onToggle, disabled }: BestAnswerToggleProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(!enabled)}
      disabled={disabled}
      className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all select-none ${
        enabled
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30"
          : "bg-[var(--surface-alt)] text-[var(--text-soft)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      title={enabled ? "Best Answer Mode ON — multiple agents will collaborate" : "Enable Best Answer Mode"}
    >
      <Sparkles
        size={12}
        className={`transition-colors ${enabled ? "text-amber-500" : "text-[var(--text-soft)] group-hover:text-[var(--text-muted)]"}`}
      />
      <span>Best Answer</span>
      <div
        className={`relative ml-0.5 h-3.5 w-6 rounded-full transition-colors ${
          enabled ? "bg-amber-500" : "bg-[var(--text-soft)]/30"
        }`}
      >
        <div
          className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-[11px]" : "translate-x-[2px]"
          }`}
        />
      </div>
    </button>
  );
}
