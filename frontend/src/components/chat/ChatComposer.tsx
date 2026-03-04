"use client";

import { useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";

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
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [value]);

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-3 pb-3 pt-2 sm:px-4">
      <div className="mx-auto flex max-w-4xl items-end gap-2">
        <div className="flex min-h-[40px] flex-1 items-end rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--text-soft)] transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            disabled={disabled}
            value={value}
            placeholder={`Message ${APP_NAME}...`}
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-white transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Send message"
        >
          <ArrowUp size={16} />
        </button>
      </div>
      <p className="mx-auto mt-1.5 max-w-4xl text-center text-[10px] text-[var(--text-soft)]">
        AI responses may be inaccurate. Verify important outputs.
      </p>
    </div>
  );
}
