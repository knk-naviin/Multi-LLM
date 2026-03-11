"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { sharedMarkdownComponents } from "@/components/ui/MarkdownRenderer";

interface StreamingMessageProps {
  /** Accumulated content so far — grows as tokens arrive from SSE */
  content: string;
  /** Whether the stream is still in progress (shows blinking cursor) */
  isStreaming: boolean;
  /** Optional prose class override */
  proseClass?: string;
}

/**
 * Renders markdown content that grows in real-time as tokens stream in.
 * No internal animation state — the parent component controls `content`
 * by appending tokens from SSE events.
 */
export function StreamingMessage({ content, isStreaming, proseClass }: StreamingMessageProps) {
  const cls =
    proseClass ||
    "prose prose-sm max-w-none select-text break-words text-[var(--text-primary)] " +
    "prose-headings:text-[var(--text-primary)] prose-p:text-inherit " +
    "prose-strong:text-inherit prose-a:text-inherit " +
    "prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] " +
    "prose-code:text-[var(--text-primary)] prose-code:before:content-none prose-code:after:content-none";

  return (
    <div className={`${cls} ${isStreaming ? "streaming-cursor" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
