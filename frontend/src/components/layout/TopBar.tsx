"use client";

import { usePathname } from "next/navigation";
import { Command } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/chat": "Chat",
  "/council": "AI Council",
  "/custom-swastik": "Custom Swastik",
  "/task-mode": "Task Mode",
  "/settings": "Settings",
  "/about": "About",
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];

  // Prefix match
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(path)) return title;
  }

  // Fallback
  if (pathname === "/") return "Dashboard";
  return "Swastik AI";
}

interface TopBarProps {
  onOpenCommandPalette?: () => void;
}

// Pages that have their own header bar — skip the global TopBar
const PAGES_WITH_OWN_HEADER = ["/council", "/task-mode", "/chat"];

export function TopBar({ onOpenCommandPalette }: TopBarProps) {
  const pathname = usePathname();

  if (PAGES_WITH_OWN_HEADER.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const title = getPageTitle(pathname);

  return (
    <div className="hidden md:flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-4">
      {/* Left — page title */}
      <h1 className="text-sm font-medium text-[var(--text-secondary)]">{title}</h1>

      {/* Right — command palette trigger */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-soft)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
        title="Command palette (⌘K)"
      >
        <Command size={12} />
        <span className="font-medium">⌘K</span>
      </button>
    </div>
  );
}
