"use client";

import { Eye, Scale, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import type { DebateStance } from "@/lib/types";

/* ─── Agent visual config ─── */

export const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gpt: { bg: "rgba(16,163,127,0.10)", text: "#10a37f", border: "rgba(16,163,127,0.25)" },
  gemini: { bg: "rgba(66,133,244,0.10)", text: "#4285f4", border: "rgba(66,133,244,0.25)" },
  claude: { bg: "rgba(217,119,6,0.10)", text: "#d97706", border: "rgba(217,119,6,0.25)" },
  grok: { bg: "rgba(239,68,68,0.10)", text: "#ef4444", border: "rgba(239,68,68,0.25)" },
};

export const AGENT_LABELS: Record<string, { name: string; short: string }> = {
  gpt: { name: "GPT", short: "G" },
  gemini: { name: "Gemini", short: "Ge" },
  claude: { name: "Claude", short: "C" },
  grok: { name: "Grok", short: "Gr" },
};

/* ─── Stance config ─── */

export const STANCE_CONFIG: Record<
  DebateStance,
  { label: string; color: string; bg: string; Icon: typeof ThumbsUp }
> = {
  initiate: { label: "Opening Argument", color: "#6366f1", bg: "rgba(99,102,241,0.12)", Icon: Sparkles },
  agree: { label: "Agrees", color: "#10b981", bg: "rgba(16,185,129,0.12)", Icon: ThumbsUp },
  oppose: { label: "Opposes", color: "#ef4444", bg: "rgba(239,68,68,0.12)", Icon: ThumbsDown },
  partial_agree: { label: "Partially Agrees", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", Icon: Scale },
  review: { label: "Reviewing", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", Icon: Eye },
};

export function getAlignment(stance?: DebateStance): "left" | "right" {
  if (!stance) return "left";
  switch (stance) {
    case "initiate":
    case "agree":
      return "right";
    case "oppose":
    case "partial_agree":
    case "review":
    default:
      return "left";
  }
}

/* ─── Agent Avatar ─── */

export function AgentAvatar({ agent, size = 28 }: { agent: string; size?: number }) {
  const colors = AGENT_COLORS[agent] || AGENT_COLORS.gpt;
  const label = AGENT_LABELS[agent] || { short: "?" };
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: colors.text,
        fontSize: size * 0.36,
      }}
    >
      {label.short}
    </div>
  );
}

/* ─── Stance Badge ─── */

export function StanceBadge({ stance }: { stance: DebateStance }) {
  const config = STANCE_CONFIG[stance] || STANCE_CONFIG.review;
  const { Icon } = config;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ background: config.bg, color: config.color }}
    >
      <Icon size={9} />
      {config.label}
    </span>
  );
}
