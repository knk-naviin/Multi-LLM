"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";

/* ─── Shared markdown component overrides ─── */
export const sharedMarkdownComponents: Components = {
  code(props) {
    const { className, children } = props;
    const source = String(children ?? "");

    // Multi-line → full code block with syntax highlighting
    if (source.includes("\n")) {
      const language = (className || "").replace("language-", "") || "text";
      const code = source.replace(/\n$/, "");
      return <CodeBlock code={code} language={language} />;
    }

    // Single-line → inline code
    return <InlineCode>{source}</InlineCode>;
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

/* ─── Convenience wrapper component ─── */
interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const cls =
    className ||
    "prose prose-sm max-w-none break-words text-[var(--text-primary)] prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit";

  return (
    <div className={cls}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
