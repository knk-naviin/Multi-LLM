"use client";

import {
  Code,
  FileText,
  BookOpen,
  Search,
  BarChart,
  Bug,
} from "lucide-react";
import type { TaskTypeConfig } from "@/lib/types";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Code,
  FileText,
  BookOpen,
  Search,
  BarChart,
  Bug,
};

interface TaskChipSelectorProps {
  taskTypes: TaskTypeConfig[];
  selected: string | null;
  onSelect: (key: string) => void;
  disabled?: boolean;
}

export function TaskChipSelector({
  taskTypes,
  selected,
  onSelect,
  disabled,
}: TaskChipSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {taskTypes.map((t) => {
        const Icon = ICON_MAP[t.icon] || Code;
        const isActive = selected === t.key;
        return (
          <button
            key={t.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(t.key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all select-none ${
              isActive
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "bg-[var(--surface-alt)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <Icon size={13} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
