"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Cpu, Trophy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { sharedMarkdownComponents } from "@/components/ui/MarkdownRenderer";
import { StreamingMessage } from "@/components/ui/StreamingMessage";
import { TaskFollowUpChat } from "@/components/taskmode/TaskFollowUpChat";
import { BRAND_GRADIENT } from "@/lib/brand";
import type { AgentConversationMessage, FollowUpMessage } from "@/lib/types";

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gpt: { bg: "rgba(16,163,127,0.10)", text: "#10a37f", border: "rgba(16,163,127,0.25)" },
  gemini: { bg: "rgba(66,133,244,0.10)", text: "#4285f4", border: "rgba(66,133,244,0.25)" },
  claude: { bg: "rgba(217,119,6,0.10)", text: "#d97706", border: "rgba(217,119,6,0.25)" },
  grok: { bg: "rgba(239,68,68,0.10)", text: "#ef4444", border: "rgba(239,68,68,0.25)" },
};

/* ── Streaming Markdown — typewriter reveal ── */

function StreamingMarkdown({ content }: { content: string }) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (displayedLength >= content.length) {
      setIsDone(true);
      return;
    }

    const chunkSize = content.length > 800 ? 12 : content.length > 300 ? 6 : 3;
    const speed = content.length > 800 ? 6 : content.length > 300 ? 10 : 14;

    timerRef.current = setTimeout(() => {
      setDisplayedLength((prev) => Math.min(prev + chunkSize, content.length));
    }, speed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [displayedLength, content.length]);

  const visibleContent = content.slice(0, displayedLength);

  return (
    <div
      className={`prose prose-sm max-w-none break-words text-[var(--text-secondary)] prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit ${
        !isDone ? "streaming-cursor" : ""
      }`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>{visibleContent}</ReactMarkdown>
    </div>
  );
}

/* ── Agent Avatar ── */

function AgentAvatar({ agent, label }: { agent: string; label?: string }) {
  const colors = AGENT_COLORS[agent] || { bg: "#6b728014", text: "#6b7280", border: "#6b728040" };
  const initials = (label || agent).slice(0, 2).toUpperCase();

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {initials}
    </div>
  );
}

/* ── Agent Bubble ── */

function AgentBubble({
  msg,
  animate,
  isStreaming,
}: {
  msg: AgentConversationMessage;
  animate: boolean;
  isStreaming?: boolean;
}) {
  const colors = AGENT_COLORS[msg.agent] || { bg: "#6b728014", text: "#6b7280", border: "#6b728040" };
  const hasError = !!msg.error;

  const proseClass =
    "prose prose-sm max-w-none break-words text-[var(--text-secondary)] prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit";

  return (
    <div className="animate-fade-in flex gap-3 py-3">
      <AgentAvatar agent={msg.agent} label={msg.agentName} />
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="mb-1 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: colors.text }}>
            {msg.agentName}
          </span>
          <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            {msg.stepLabel}
          </span>
          {msg.iteration > 1 && (
            <span className="text-[10px] text-[var(--text-soft)]">
              Iteration {msg.iteration}
            </span>
          )}
        </div>

        {/* Content */}
        {hasError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
            {msg.error}
          </div>
        ) : isStreaming ? (
          <StreamingMessage content={msg.content} isStreaming={true} proseClass={proseClass} />
        ) : animate ? (
          <StreamingMarkdown content={msg.content} />
        ) : (
          <div className={proseClass}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>{msg.content}</ReactMarkdown>
          </div>
        )}

        {/* Footer */}
        {!hasError && !isStreaming && (
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[var(--text-soft)]">
            <span className="flex items-center gap-1">
              <Clock size={9} />
              {msg.responseTime.toFixed(1)}s
            </span>
            {msg.tokens > 0 && (
              <span className="flex items-center gap-1">
                <Cpu size={9} />
                ~{msg.tokens} tokens
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Final Result Card ── */

function FinalResultCard({
  content,
  agentName,
  responseTime,
  tokens,
  animate,
}: {
  content: string;
  agentName?: string;
  responseTime?: number;
  tokens?: number;
  animate: boolean;
}) {
  return (
    <div className="animate-fade-in mt-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-white"
          style={{ background: BRAND_GRADIENT }}
        >
          <Trophy size={12} />
        </div>
        <div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Final Optimized Result
          </span>
          {agentName && (
            <span className="ml-2 text-[10px] text-[var(--text-soft)]">
              synthesized by {agentName}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {animate ? (
        <StreamingMarkdown content={content} />
      ) : (
        <div className="prose prose-sm max-w-none break-words text-[var(--text-primary)] prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>{content}</ReactMarkdown>
        </div>
      )}

      {/* Footer */}
      {(responseTime != null || (tokens != null && tokens > 0)) && (
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-soft)]">
          {responseTime != null && (
            <span className="flex items-center gap-1">
              <Clock size={9} />
              {responseTime.toFixed(1)}s
            </span>
          )}
          {tokens != null && tokens > 0 && (
            <span className="flex items-center gap-1">
              <Cpu size={9} />
              ~{tokens} tokens
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Final Result Wrapper (tracks animation) ── */

function FinalResultWrapper({
  finalResult,
  animatedIdsRef,
}: {
  finalResult: {
    content: string;
    agent?: string;
    agentName?: string;
    responseTime?: number;
    tokens?: number;
  };
  animatedIdsRef: React.MutableRefObject<Set<string>>;
}) {
  const shouldAnimate = !animatedIdsRef.current.has("final-result");
  if (shouldAnimate) {
    animatedIdsRef.current.add("final-result");
  }

  return (
    <FinalResultCard
      content={finalResult.content}
      agentName={finalResult.agentName}
      responseTime={finalResult.responseTime}
      tokens={finalResult.tokens}
      animate={shouldAnimate}
    />
  );
}

/* ── Main Panel ── */

interface AgentConversationPanelProps {
  messages: AgentConversationMessage[];
  streamingStep?: {
    step: string;
    stepLabel: string;
    agent: string;
    content: string;
    iteration: number;
  } | null;
  finalResult: {
    content: string;
    agent?: string;
    agentName?: string;
    responseTime?: number;
    tokens?: number;
  } | null;
  totalTime?: number;
  totalTokens?: number;
  isComplete: boolean;
  workflowId?: string | null;
  taskType?: string;
  followupMessages?: FollowUpMessage[];
}

export function AgentConversationPanel({
  messages,
  streamingStep,
  finalResult,
  totalTime,
  totalTokens,
  isComplete,
  workflowId,
  taskType,
  followupMessages,
}: AgentConversationPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const animatedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, finalResult, streamingStep]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
      {/* Header */}
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Agent Conversation
      </h3>

      {/* Messages */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {messages.map((msg) => {
          const shouldAnimate = !animatedIdsRef.current.has(msg.id);
          if (shouldAnimate) {
            animatedIdsRef.current.add(msg.id);
          }
          return (
            <AgentBubble key={msg.id} msg={msg} animate={shouldAnimate} />
          );
        })}

        {/* Live streaming step */}
        {streamingStep && streamingStep.content.length > 0 && (
          <AgentBubble
            msg={{
              id: `streaming-${streamingStep.step}-${streamingStep.iteration}`,
              step: streamingStep.step,
              stepLabel: streamingStep.stepLabel,
              agent: streamingStep.agent,
              agentName: streamingStep.agent.toUpperCase(),
              content: streamingStep.content,
              responseTime: 0,
              tokens: 0,
              iteration: streamingStep.iteration,
            }}
            animate={false}
            isStreaming={true}
          />
        )}
      </div>

      {/* Final Result */}
      {finalResult && (
        <FinalResultWrapper
          finalResult={finalResult}
          animatedIdsRef={animatedIdsRef}
        />
      )}

      {/* Completion Metrics */}
      {isComplete && (totalTime != null || totalTokens != null) && (
        <div className="mt-4 flex items-center justify-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[11px] text-[var(--text-muted)]">
          {totalTime != null && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              Total: {totalTime.toFixed(1)}s
            </span>
          )}
          {totalTokens != null && totalTokens > 0 && (
            <span className="flex items-center gap-1">
              <Cpu size={10} />
              ~{totalTokens} tokens
            </span>
          )}
          <span className="flex items-center gap-1 text-green-500 font-medium">
            Workflow Complete
          </span>
        </div>
      )}

      {/* Follow-Up Chat */}
      {isComplete && workflowId && (
        <TaskFollowUpChat
          workflowId={workflowId}
          taskType={taskType || "coding"}
          initialMessages={followupMessages}
        />
      )}

      <div ref={endRef} />
    </div>
  );
}
