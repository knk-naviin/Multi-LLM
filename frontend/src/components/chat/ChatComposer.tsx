"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Globe, Mic, Paperclip } from "lucide-react";

import { APP_NAME } from "@/lib/constants";

interface ChatComposerProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function ChatComposer({ value, disabled, onChange, onSend }: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [value]);

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-[var(--stroke)] bg-[var(--surface)]/85 px-3 pb-3 pt-2 backdrop-blur-sm sm:px-4 sm:pb-4">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-[var(--stroke)] bg-[var(--surface-alt)] shadow-sm">
        <div className="flex items-end gap-2 p-3">
          <textarea
            ref={textareaRef}
            rows={1}
            disabled={disabled}
            value={value}
            placeholder={`Message ${APP_NAME}...`}
            className="max-h-[180px] min-h-[28px] w-full resize-none bg-transparent text-sm leading-6 text-[var(--text-main)] outline-none placeholder:text-[var(--text-soft)]"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) {
                  onSend();
                }
              }
            }}
          />

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-[var(--surface)] disabled:text-[var(--text-soft)]"
            aria-label="Send message"
          >
            <ArrowUp size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--stroke)] px-2 py-2 sm:px-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--text-main)]"
            >
              <Paperclip size={14} />
              <span className="hidden sm:inline">Attach</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--text-main)]"
            >
              <Globe size={14} />
              <span className="hidden sm:inline">Search</span>
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--text-main)]"
            >
              <Mic size={14} />
              <span className="hidden sm:inline">Voice</span>
            </button>
          </div>
          <span className="hidden text-[11px] text-[var(--text-soft)] sm:block">Enter to send, Shift+Enter for newline</span>
        </div>
      </div>

      <p className="mx-auto mt-2 max-w-4xl text-center text-[11px] text-[var(--text-soft)]">
        AI responses may be inaccurate. Verify important outputs.
      </p>
    </div>
  );
}
