"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Cpu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  modelUsed?: string | null;
  detail?: string;
  loading?: boolean;
  loadingNode?: React.ReactNode;
  animateTypewriter?: boolean;
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
    <div className="my-2 overflow-hidden rounded-lg border border-[var(--border)] bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-zinc-400">
        <span>{language}</span>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12px] leading-5 text-zinc-100">
        <code>{source}</code>
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
        <code className="rounded bg-[var(--surface-alt)] px-1 py-0.5 font-mono text-[12px] text-[var(--text-primary)]">
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
};

export function MessageBubble({
  role,
  content,
  modelUsed,
  detail,
  loading,
  loadingNode,
}: MessageBubbleProps) {
  const isAssistant = role === "assistant";

  const renderedContent = useMemo(() => {
    if (loading) {
      return <div className="py-0.5">{loadingNode}</div>;
    }

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    );
  }, [content, loading, loadingNode]);

  if (!isAssistant) {
    return (
      <div className="flex justify-end py-1.5">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-[var(--brand)] px-3.5 py-2 text-sm leading-6 text-white sm:max-w-[65%]">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="py-1.5">
      <div className="text-sm leading-6 text-[var(--text-primary)]">
        <div className="prose prose-sm max-w-none break-words prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit">
          {renderedContent}
        </div>
      </div>

      {!loading && modelUsed && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-soft)]">
          <Cpu size={10} />
          <span className="font-medium uppercase">{modelUsed}</span>
          {detail && <span className="text-[var(--text-soft)]">&middot; {detail}</span>}
        </div>
      )}
    </div>
  );
}
