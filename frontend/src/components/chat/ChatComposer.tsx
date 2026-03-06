"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Layers } from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { BRAND_GRADIENT } from "@/lib/brand";
import { BestAnswerToggle } from "@/components/chat/BestAnswerToggle";

interface ChatComposerProps {
  value: string;
  disabled?: boolean;
  bestAnswerMode?: boolean;
  taskModeOpen?: boolean;
  onToggleBestAnswer?: (enabled: boolean) => void;
  onToggleTaskMode?: () => void;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function ChatComposer({
  value,
  disabled,
  bestAnswerMode = false,
  taskModeOpen = false,
  onToggleBestAnswer,
  onToggleTaskMode,
  onChange,
  onSend,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [value]);

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-3 pb-3 pt-2 sm:px-4">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-end gap-2">
          <div className="flex min-h-[40px] flex-1 items-end rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--text-soft)] transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              disabled={disabled || taskModeOpen}
              value={value}
              placeholder={
                taskModeOpen
                  ? "Use the Task Mode panel above..."
                  : `Message ${APP_NAME}...`
              }
              className="max-h-[150px] min-h-[20px] w-full resize-none bg-transparent text-sm leading-5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)]"
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canSend) onSend();
                }
              }}
            />
          </div>

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ background: canSend ? BRAND_GRADIENT : undefined }}
            aria-label="Send message"
          >
            <ArrowUp size={16} />
          </button>
        </div>

        {/* Mode toggles + disclaimer */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {onToggleBestAnswer && (
              <BestAnswerToggle
                enabled={bestAnswerMode}
                onToggle={(v) => {
                  onToggleBestAnswer(v);
                }}
                disabled={disabled || taskModeOpen}
              />
            )}
            {onToggleTaskMode && (
              <button
                type="button"
                onClick={onToggleTaskMode}
                disabled={disabled}
                className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all select-none ${
                  taskModeOpen
                    ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30"
                    : "bg-[var(--surface-alt)] text-[var(--text-soft)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <Layers size={12} />
                <span>Task Mode</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-[var(--text-soft)] shrink-0">
            AI responses may be inaccurate. Verify important outputs.
          </p>
        </div>
      </div>
    </div>
  );
}
