"use client";

import { useMemo, useState } from "react";
import { Bot, Check, Copy, Cpu, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { TypewriterText } from "@/components/common/TypewriterText";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  modelUsed?: string | null;
  detail?: string;
  loading?: boolean;
  loadingNode?: React.ReactNode;
  animateTypewriter?: boolean;
}

function isPlainText(content: string): boolean {
  return !/[`*_#\[\]<>\-|\n]/.test(content);
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
    <div className="my-2 overflow-hidden rounded-xl border border-[var(--stroke)] bg-[#111827] text-slate-100">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-300">
        <span>{language}</span>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12px] leading-6">
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
        <code className="rounded bg-[var(--surface-alt)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text-main)]">
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
        className="text-indigo-500 underline underline-offset-4 hover:text-indigo-400"
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
  animateTypewriter,
}: MessageBubbleProps) {
  const isAssistant = role === "assistant";

  const renderedContent = useMemo(() => {
    if (loading) {
      return <div className="py-1">{loadingNode}</div>;
    }

    if (animateTypewriter && isAssistant && isPlainText(content)) {
      return <TypewriterText text={content} />;
    }

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    );
  }, [animateTypewriter, content, isAssistant, loading, loadingNode]);

  return (
    <article className={`flex w-full gap-3 ${isAssistant ? "items-start" : "flex-row-reverse items-start"}`}>
      <div
        className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          isAssistant
            ? "border-[var(--stroke)] bg-[var(--surface-alt)] text-indigo-500"
            : "border-indigo-500/30 bg-indigo-600 text-white"
        }`}
      >
        {isAssistant ? <Bot size={15} /> : <User size={14} />}
      </div>

      <div className={`max-w-[84%] ${isAssistant ? "items-start" : "items-end"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl border px-4 py-3 text-sm leading-7 shadow-sm ${
            isAssistant
              ? "border-[var(--stroke)] bg-[var(--surface-alt)] text-[var(--text-main)]"
              : "border-indigo-500/20 bg-gradient-to-br from-indigo-600 to-indigo-500 text-white"
          } break-words`}
        >
          <div className="prose prose-sm max-w-none break-words prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit">
            {renderedContent}
          </div>
        </div>

        {isAssistant && !loading ? (
          <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-[var(--text-soft)]">
            {modelUsed ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--stroke)] bg-[var(--surface-alt)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
                <Cpu size={10} />
                {modelUsed}
              </span>
            ) : null}
            {detail ? <span>{detail}</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
