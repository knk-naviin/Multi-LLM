"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Cpu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { BRAND_GRADIENT } from "@/lib/brand";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  modelUsed?: string | null;
  detail?: string;
  loading?: boolean;
  loadingNode?: React.ReactNode;
  animateTypewriter?: boolean;
  showModelInfo?: boolean;
  timestamp?: number;
}

function CodeRenderer({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const source = String(children ?? "").replace(/\n$/, "");
  const language = (className || "").replace("language-", "") || "text";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[var(--border)] max-w-full">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1.5 text-[11px]">
        <span className="font-mono font-medium text-[var(--text-muted)]">{language}</span>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="overflow-x-auto bg-[#D3D3D3] p-4 text-[13px] leading-6 dark:bg-[#1e1e1e]"
        style={{ fontFamily: "'Fira Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace" }}
      >
        <code
          className="text-[#1e1e1e] dark:text-[#d4d4d4]"
          style={{ fontFamily: "inherit" }}
        >
          {source}
        </code>
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  code(props) {
    const { className, children } = props;
    const source = String(children ?? "");

    if (!source.includes("\n")) {
      return (
        <code
          className="rounded border border-[var(--border)] bg-[#D3D3D3] px-1.5 py-0.5 text-[12.5px] text-[#1e1e1e] dark:bg-[#2d2d2d] dark:text-[#d4d4d4]"
          style={{ fontFamily: "'Fira Code', 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace" }}
        >
          {source}
        </code>
      );
    }

    return <CodeRenderer className={className}>{children}</CodeRenderer>;
  },
  a(props) {
    return (
      <a
        {...props}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--brand-text)] underline underline-offset-2 hover:opacity-80"
      />
    );
  },
  table(props) {
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-[var(--border)] max-w-full">
        <table className="w-full text-sm" {...props} />
      </div>
    );
  },
  thead(props) {
    return <thead className="bg-[var(--surface-alt)]" {...props} />;
  },
  th(props) {
    return (
      <th
        className="border-b border-[var(--border)] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
        {...props}
      />
    );
  },
  td(props) {
    return (
      <td
        className="border-b border-[var(--border)] px-3 py-2.5 text-[var(--text-primary)]"
        {...props}
      />
    );
  },
};

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StreamingText({ content }: { content: string }) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (displayedLength >= content.length) {
      setIsDone(true);
      return;
    }

    const chunkSize = content.length > 500 ? 8 : content.length > 200 ? 4 : 2;
    const speed = content.length > 500 ? 8 : content.length > 200 ? 12 : 16;

    timerRef.current = setTimeout(() => {
      setDisplayedLength((prev) => Math.min(prev + chunkSize, content.length));
    }, speed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [displayedLength, content.length]);

  const visibleContent = content.slice(0, displayedLength);

  return (
    <div className="animate-fade-in">
      <div className={`prose prose-sm max-w-none select-text break-words prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit ${!isDone ? "streaming-cursor" : ""}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {visibleContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export function MessageBubble({
  role,
  content,
  modelUsed,
  detail,
  loading,
  loadingNode,
  animateTypewriter,
  showModelInfo = true,
  timestamp,
}: MessageBubbleProps) {
  const isAssistant = role === "assistant";

  const renderedContent = useMemo(() => {
    if (loading) {
      return (
        <div className="py-1">
          <div className="flex items-center gap-3">
            {loadingNode}
            <span className="text-xs text-[var(--text-soft)]">{detail || "Thinking..."}</span>
          </div>
        </div>
      );
    }

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    );
  }, [content, detail, loading, loadingNode]);

  if (!isAssistant) {
    return (
      <div className="animate-fade-in py-2">
        <div className="flex flex-col items-end gap-1">
          <div
            className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-white select-text sm:max-w-[65%]"
            style={{ background: BRAND_GRADIENT }}
          >
            {content}
          </div>
          {timestamp && (
            <span className="text-[10px] text-[var(--text-soft)] mr-1">{formatTimestamp(timestamp)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in py-2 select-text">
      <div className="text-[14px] leading-7 text-[var(--text-primary)] overflow-hidden">
        {animateTypewriter && !loading ? (
          <StreamingText content={content} />
        ) : (
          <div className="prose prose-sm max-w-none select-text break-words prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit">
            {renderedContent}
          </div>
        )}
      </div>

      {/* Model info + timestamp — shown below the response */}
      {!loading && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-soft)]">
          {showModelInfo && modelUsed && (
            <>
              <Cpu size={10} />
              <span className="font-medium uppercase">{modelUsed}</span>
              {detail && <span>&middot; {detail}</span>}
            </>
          )}
          {timestamp && (
            <>
              {showModelInfo && modelUsed && <span>&middot;</span>}
              <span>{formatTimestamp(timestamp)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
