"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Sparkles,
  Layers,
  Settings,
  Moon,
  Sun,
  PanelLeftClose,
  Search,
  Plus,
} from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  category: "Navigation" | "Actions";
  keywords: string[];
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = useMemo<CommandItem[]>(() => {
    const ThemeIcon = theme === "dark" ? Sun : Moon;

    return [
      {
        id: "go-dashboard",
        label: "Go to Dashboard",
        icon: LayoutDashboard,
        category: "Navigation",
        keywords: ["dashboard", "home", "overview", "stats"],
        action: () => { router.push("/dashboard"); onClose(); },
      },
      {
        id: "go-chat",
        label: "Go to Chat",
        icon: MessageSquare,
        category: "Navigation",
        keywords: ["chat", "conversation", "message", "talk"],
        action: () => { router.push("/chat"); onClose(); },
      },
      {
        id: "go-council",
        label: "Go to AI Council",
        icon: Users,
        category: "Navigation",
        keywords: ["council", "debate", "multi", "agent"],
        action: () => { router.push("/council"); onClose(); },
      },
      {
        id: "go-custom-swastik",
        label: "Go to Custom Swastik",
        icon: Sparkles,
        category: "Navigation",
        keywords: ["custom", "swastik", "workflow", "agent"],
        action: () => { router.push("/custom-swastik"); onClose(); },
      },
      {
        id: "go-task-mode",
        label: "Go to Task Mode",
        icon: Layers,
        category: "Navigation",
        keywords: ["task", "mode", "workflow", "pipeline"],
        action: () => { router.push("/task-mode"); onClose(); },
      },
      {
        id: "go-settings",
        label: "Go to Settings",
        icon: Settings,
        category: "Navigation",
        keywords: ["settings", "preferences", "config"],
        action: () => { router.push("/settings"); onClose(); },
      },
      {
        id: "new-chat",
        label: "New Chat",
        icon: Plus,
        category: "Actions",
        keywords: ["new", "chat", "create", "start"],
        action: () => {
          router.push("/chat");
          setTimeout(() => window.dispatchEvent(new CustomEvent("swastik:new-chat")), 100);
          onClose();
        },
      },
      {
        id: "toggle-theme",
        label: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
        icon: ThemeIcon,
        category: "Actions",
        keywords: ["theme", "dark", "light", "mode", "toggle"],
        action: () => { toggleTheme(); onClose(); },
      },
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        icon: PanelLeftClose,
        category: "Actions",
        keywords: ["sidebar", "collapse", "expand", "toggle", "panel"],
        action: () => {
          window.dispatchEvent(new Event("swastik:toggle-sidebar"));
          onClose();
        },
      },
    ];
  }, [router, onClose, theme, toggleTheme]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.keywords.some((kw) => kw.includes(q))
    );
  }, [query, commands]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filtered]);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const items = listRef.current?.querySelectorAll("[data-cmd-item]");
    if (items && items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
        return;
      }
    },
    [filtered, selectedIndex, onClose]
  );

  if (!open) return null;

  let itemIndex = -1;

  return (
    <div
      className="cmd-palette-backdrop fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="cmd-palette-content w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <Search size={16} className="shrink-0 text-[var(--text-soft)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-soft)] outline-none"
          />
          <kbd className="shrink-0 rounded border border-[var(--border)] bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-soft)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto custom-scrollbar py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[var(--text-soft)]">
              No commands found
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">
                  {category}
                </div>
                {items.map((cmd) => {
                  itemIndex++;
                  const currentIdx = itemIndex;
                  const Icon = cmd.icon;
                  const isSelected = currentIdx === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      data-cmd-item
                      type="button"
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(currentIdx)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isSelected
                          ? "bg-[var(--brand-subtle)] text-[var(--brand)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]"
                      }`}
                    >
                      <Icon size={16} className={isSelected ? "text-[var(--brand)]" : "text-[var(--text-soft)]"} />
                      <span className="flex-1 text-left">{cmd.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
