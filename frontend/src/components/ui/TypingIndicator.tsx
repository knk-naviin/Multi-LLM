"use client";

interface TypingIndicatorProps {
  /** Text label to show (e.g. "GPT is generating...") */
  label?: string;
  /** Dot color — defaults to var(--brand) */
  color?: string;
}

/**
 * Animated typing indicator with bouncing dots.
 * Reuses the existing `.typing-dot` CSS animation from globals.css.
 */
export function TypingIndicator({
  label = "Generating response...",
  color,
}: TypingIndicatorProps) {
  const dotColor = color || "var(--brand)";

  return (
    <div className="animate-fade-in flex items-center gap-2 py-2">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <div className="flex gap-1">
        <span className="typing-dot" style={{ background: dotColor }} />
        <span
          className="typing-dot"
          style={{ animationDelay: "0.15s", background: dotColor }}
        />
        <span
          className="typing-dot"
          style={{ animationDelay: "0.3s", background: dotColor }}
        />
      </div>
    </div>
  );
}
