"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Cpu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { BRAND_GRADIENT } from "@/lib/brand";
import { AgentChatDropdown } from "@/components/chat/AgentChatDropdown";
import { TaskWorkflowDropdown } from "@/components/chat/TaskWorkflowDropdown";
import { sharedMarkdownComponents } from "@/components/ui/MarkdownRenderer";
import { StreamingMessage } from "@/components/ui/StreamingMessage";
import { TypingIndicator } from "@/components/ui/TypingIndicator";
import type { AgentChatMessage, WorkflowStepMessage } from "@/lib/types";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  modelUsed?: string | null;
  detail?: string;
  loading?: boolean;
  loadingNode?: React.ReactNode;
  animateTypewriter?: boolean;
  isStreaming?: boolean;
  showModelInfo?: boolean;
  timestamp?: number;
  isBestAnswer?: boolean;
  agentChat?: AgentChatMessage[];
  synthesizedBy?: string;
  responseTimeSeconds?: number;
  isTaskMode?: boolean;
  taskType?: string;
  workflowChat?: WorkflowStepMessage[];
}

const markdownComponents = sharedMarkdownComponents;

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
  isStreaming,
  showModelInfo = true,
  timestamp,
  isBestAnswer,
  agentChat,
  synthesizedBy,
  responseTimeSeconds,
  isTaskMode,
  taskType,
  workflowChat,
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
        {isStreaming ? (
          content.length === 0 ? (
            <TypingIndicator label="Generating response..." />
          ) : (
            <StreamingMessage content={content} isStreaming={true} />
          )
        ) : animateTypewriter && !loading ? (
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
          {isBestAnswer && (
            <>
              {showModelInfo && modelUsed && <span>&middot;</span>}
              <span className="text-amber-500 font-medium">Best Answer</span>
            </>
          )}
          {isTaskMode && (
            <>
              {showModelInfo && modelUsed && <span>&middot;</span>}
              <span className="text-indigo-500 font-medium">Task Mode</span>
              {taskType && (
                <>
                  <span>&middot;</span>
                  <span className="capitalize">{taskType.replace("_", " ")}</span>
                </>
              )}
            </>
          )}
          {timestamp && (
            <>
              {(showModelInfo && modelUsed) || isBestAnswer || isTaskMode ? <span>&middot;</span> : null}
              <span>{formatTimestamp(timestamp)}</span>
            </>
          )}
        </div>
      )}

      {/* Agent Chat Dropdown — only for best answer responses */}
      {!loading && isBestAnswer && agentChat && agentChat.length > 0 && (
        <AgentChatDropdown
          agentChat={agentChat}
          synthesizedBy={synthesizedBy}
          responseTime={responseTimeSeconds}
        />
      )}

      {/* Task Workflow Dropdown — only for task mode responses */}
      {!loading && isTaskMode && workflowChat && workflowChat.length > 0 && (
        <TaskWorkflowDropdown
          workflowChat={workflowChat}
          taskType={taskType}
          responseTime={responseTimeSeconds}
        />
      )}
    </div>
  );
}
