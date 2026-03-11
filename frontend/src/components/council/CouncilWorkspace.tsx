"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUp,
  BarChart3,
  Clock,
  Cpu,
  GitBranch,
  Loader2,
  MessageSquare,
  Trophy,
  Users,
  AlertTriangle,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { sharedMarkdownComponents } from "@/components/ui/MarkdownRenderer";
import { StreamingMessage } from "@/components/ui/StreamingMessage";
import { useAuth } from "@/contexts/AuthContext";
import { useAlerts } from "@/contexts/AlertContext";
import { BRAND_GRADIENT } from "@/lib/brand";
import type {
  CouncilAgent,
  CouncilAgentMetric,
  DebateMessage,
  DebateStance,
} from "@/lib/types";
import {
  AGENT_COLORS,
  AGENT_LABELS,
  STANCE_CONFIG,
  getAlignment,
  AgentAvatar,
  StanceBadge,
} from "./shared";

const DebateTreeView = dynamic(() => import("./DebateTreeView"), { ssr: false });

/* ─── Streaming Markdown (typewriter) ─── */

function StreamingMarkdown({
  content,
  proseClass,
}: {
  content: string;
  proseClass?: string;
}) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (displayedLength >= content.length) {
      setIsDone(true);
      return;
    }

    const chunkSize = content.length > 800 ? 12 : content.length > 400 ? 6 : 3;
    const speed = content.length > 800 ? 6 : content.length > 400 ? 10 : 14;

    timerRef.current = setTimeout(() => {
      setDisplayedLength((prev) => Math.min(prev + chunkSize, content.length));
    }, speed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [displayedLength, content.length]);

  const visibleContent = content.slice(0, displayedLength);

  const cls =
    proseClass ||
    "prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-1 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] prose-code:text-[var(--text-primary)] prose-code:before:content-none prose-code:after:content-none";

  return (
    <div className={`${cls} ${!isDone ? "streaming-cursor" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>
        {visibleContent}
      </ReactMarkdown>
    </div>
  );
}

/* ─── Debate Bubble (WhatsApp-style) ─── */

function DebateBubble({
  agent,
  agentName,
  role,
  stance,
  references,
  content,
  responseTime,
  tokens,
  error,
  animate,
  isStreaming,
}: {
  agent: string;
  agentName: string;
  role: string;
  stance: DebateStance;
  references: string[];
  content: string;
  responseTime?: number;
  tokens?: number;
  error?: string;
  animate?: boolean;
  isStreaming?: boolean;
}) {
  const colors = AGENT_COLORS[agent] || AGENT_COLORS.gpt;
  const alignment = getAlignment(stance);
  const isRight = alignment === "right";

  const proseClass =
    "prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-1 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] prose-code:text-[var(--text-primary)] prose-code:before:content-none prose-code:after:content-none";

  if (error) {
    return (
      <div
        className={`${isRight ? "animate-slide-in-right" : "animate-slide-in-left"} flex ${isRight ? "justify-end" : "justify-start"} py-2`}
      >
        <div className={`flex items-start gap-2.5 max-w-[85%] sm:max-w-[75%] ${isRight ? "flex-row-reverse" : ""}`}>
          <AgentAvatar agent={agent} size={30} />
          <div className="min-w-0">
            <div className={`mb-0.5 flex items-center gap-1.5 flex-wrap ${isRight ? "justify-end" : ""}`}>
              <span className="text-[11px] font-semibold" style={{ color: colors.text }}>
                {agentName}
              </span>
              <span className="text-[10px] text-[var(--text-soft)]">{role}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">
              <AlertTriangle size={12} />
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${isRight ? "animate-slide-in-right" : "animate-slide-in-left"} flex ${isRight ? "justify-end" : "justify-start"} py-2`}
    >
      <div className={`flex items-start gap-2.5 max-w-[85%] sm:max-w-[75%] ${isRight ? "flex-row-reverse" : ""}`}>
        <AgentAvatar agent={agent} size={30} />
        <div className="min-w-0">
          {/* Header: Agent name, role, stance badge */}
          <div className={`mb-0.5 flex items-center gap-1.5 flex-wrap ${isRight ? "justify-end" : ""}`}>
            {isRight ? (
              <>
                <StanceBadge stance={stance} />
                <span className="text-[10px] text-[var(--text-soft)]">{role}</span>
                <span className="text-[11px] font-semibold" style={{ color: colors.text }}>
                  {agentName}
                </span>
              </>
            ) : (
              <>
                <span className="text-[11px] font-semibold" style={{ color: colors.text }}>
                  {agentName}
                </span>
                <span className="text-[10px] text-[var(--text-soft)]">{role}</span>
                <StanceBadge stance={stance} />
              </>
            )}
          </div>

          {/* Reference line */}
          {references.length > 0 && (
            <div className={`mb-1 text-[10px] italic text-[var(--text-soft)] ${isRight ? "text-right" : ""}`}>
              Responding to {references.join(", ")}
            </div>
          )}

          {/* Bubble */}
          <div
            className={`rounded-2xl ${isRight ? "rounded-br-md" : "rounded-tl-md"} px-4 py-2.5 text-sm leading-relaxed select-text`}
            style={
              isRight
                ? { background: colors.bg, border: `1px solid ${colors.border}` }
                : { background: "var(--surface)", border: "1px solid var(--border)" }
            }
          >
            {isStreaming ? (
              <StreamingMessage content={content} isStreaming={true} proseClass={proseClass} />
            ) : animate ? (
              <StreamingMarkdown content={content} proseClass={proseClass} />
            ) : (
              <div className={proseClass}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Metrics footer */}
          <div className={`mt-1 flex items-center gap-2 text-[10px] text-[var(--text-soft)] ${isRight ? "justify-end" : ""}`}>
            {responseTime != null && (
              <span className="flex items-center gap-0.5">
                <Clock size={9} />
                {responseTime}s
              </span>
            )}
            {tokens != null && tokens > 0 && (
              <span className="flex items-center gap-0.5">
                <Cpu size={9} />
                ~{tokens} tokens
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Debate Typing Indicator ─── */

function DebateTypingIndicator({
  agent,
  agentName,
  role,
  sequence,
  total,
}: {
  agent: string;
  agentName: string;
  role: string;
  sequence: number;
  total: number;
}) {
  const colors = AGENT_COLORS[agent] || AGENT_COLORS.gpt;
  const isSynthesis = agent === "synthesis";
  const statusText = isSynthesis
    ? "Generating final synthesis..."
    : sequence === 1
      ? `${agentName} is forming an initial analysis...`
      : `${agentName} is analyzing previous responses...`;

  return (
    <div className="animate-fade-in flex items-center gap-3 py-3 px-1">
      {!isSynthesis && <AgentAvatar agent={agent} size={28} />}
      {isSynthesis && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: BRAND_GRADIENT }}
        >
          <Trophy size={12} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">{statusText}</span>
        <div className="flex gap-1">
          <span className="typing-dot" style={{ background: isSynthesis ? "#6366f1" : colors.text }} />
          <span className="typing-dot" style={{ animationDelay: "0.15s", background: isSynthesis ? "#6366f1" : colors.text }} />
          <span className="typing-dot" style={{ animationDelay: "0.3s", background: isSynthesis ? "#6366f1" : colors.text }} />
        </div>
        {!isSynthesis && (
          <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-soft)]">
            {sequence} of {total}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Synthesis Bubble ─── */

function SynthesisBubble({
  content,
  agent,
  responseTime,
  tokens,
  animate,
  isStreaming,
}: {
  content: string;
  agent: string;
  responseTime?: number;
  tokens?: number;
  animate?: boolean;
  isStreaming?: boolean;
}) {
  return (
    <div className="animate-fade-in my-2">
      <div className="rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 px-5 py-4">
        <div className="mb-2 flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" />
          <span className="text-sm font-bold text-[var(--text-primary)]">
            Final Council Summary
          </span>
          <span className="text-[10px] text-[var(--text-soft)]">
            synthesized via {AGENT_LABELS[agent]?.name || agent}
          </span>
        </div>
        {isStreaming ? (
          <StreamingMessage
            content={content}
            isStreaming={true}
            proseClass="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-1 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] select-text"
          />
        ) : animate ? (
          <StreamingMarkdown
            content={content}
            proseClass="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-1 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] select-text"
          />
        ) : (
          <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-1 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] select-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={sharedMarkdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-soft)]">
          {responseTime != null && (
            <span className="flex items-center gap-0.5">
              <Clock size={9} />
              {responseTime}s
            </span>
          )}
          {tokens != null && tokens > 0 && (
            <span className="flex items-center gap-0.5">
              <Cpu size={9} />
              ~{tokens} tokens
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Metrics Card ─── */

function MetricsCard({
  metrics,
  totalTime,
  totalTokens,
}: {
  metrics: CouncilAgentMetric[];
  totalTime: number;
  totalTokens: number;
}) {
  return (
    <div className="animate-fade-in my-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <BarChart3 size={16} />
        Debate Metrics
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-3">
        {metrics.map((m) => {
          const colors = AGENT_COLORS[m.agent] || AGENT_COLORS.gpt;
          return (
            <div
              key={m.agent}
              className="rounded-lg p-2.5"
              style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <AgentAvatar agent={m.agent} size={18} />
                <span className="text-[11px] font-semibold" style={{ color: colors.text }}>
                  {m.name}
                </span>
              </div>
              <div className="space-y-0.5 text-[10px] text-[var(--text-muted)]">
                <div className="flex justify-between">
                  <span>Avg Time</span>
                  <span className="font-medium text-[var(--text-primary)]">{m.avg_response_time}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Tokens</span>
                  <span className="font-medium text-[var(--text-primary)]">~{m.total_tokens}</span>
                </div>
                {m.errors > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>Errors</span>
                    <span className="font-medium">{m.errors}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 border-t border-[var(--border)] pt-2 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          Total: <strong className="text-[var(--text-primary)]">{totalTime}s</strong>
        </span>
        <span className="flex items-center gap-1">
          <Cpu size={11} />
          Tokens: <strong className="text-[var(--text-primary)]">~{totalTokens}</strong>
        </span>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

interface TypingAgentState {
  agent: string;
  name: string;
  role: string;
  sequence: number;
  total: number;
}

function CouncilWorkspace() {
  const { token } = useAuth();
  const { showAlert } = useAlerts();

  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [debating, setDebating] = useState(false);
  const [typingAgent, setTypingAgent] = useState<TypingAgentState | null>(null);
  const [viewMode, setViewMode] = useState<"chat" | "tree">("chat");
  const [streamingDebate, setStreamingDebate] = useState<{
    agent: string; name: string; role: string; content: string; sequence: number; total: number;
  } | null>(null);
  const [streamingSynthesis, setStreamingSynthesis] = useState<{
    agent: string; content: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const animatedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typingAgent, streamingDebate, streamingSynthesis]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [prompt]);

  /* ── SSE Event Handler ── */

  function handleSSEEvent(data: Record<string, unknown>) {
    const type = data.type as string;

    switch (type) {
      case "council_start":
        break;

      case "agent_typing":
        setTypingAgent({
          agent: data.agent as string,
          name: data.name as string,
          role: data.role as string,
          sequence: data.sequence as number,
          total: data.total as number,
        });
        // Initialize streaming state for the next agent
        setStreamingDebate(null);
        break;

      case "agent_token":
        // Clear typing indicator once tokens start flowing
        setTypingAgent(null);
        setStreamingDebate((prev) => {
          const agent = data.agent as string;
          const token = data.content as string;
          if (prev && prev.agent === agent) {
            return { ...prev, content: prev.content + token };
          }
          // First token from a new agent — initialize
          const cfg = AGENT_LABELS[agent];
          return {
            agent,
            name: cfg?.name || agent,
            role: "",
            content: token,
            sequence: (data.sequence as number) || 1,
            total: 0,
          };
        });
        break;

      case "debate_response":
        setTypingAgent(null);
        setStreamingDebate(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `debate-${data.agent}-${Date.now()}`,
            type: "debate_response",
            agent: data.agent as CouncilAgent,
            agentName: data.name as string,
            agentRole: data.role as string,
            content: data.content as string,
            stance: data.stance as DebateStance,
            references: (data.references as string[]) || [],
            sequence: data.sequence as number,
            totalAgents: data.total as number,
            responseTime: data.response_time as number,
            tokens: data.tokens as number,
            error: data.error as string | undefined,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "synthesis_token":
        // Clear typing indicator once synthesis tokens flow
        setTypingAgent(null);
        setStreamingSynthesis((prev) => {
          const token = data.content as string;
          if (prev) {
            return { ...prev, content: prev.content + token };
          }
          return { agent: data.agent as string, content: token };
        });
        break;

      case "synthesis":
        setTypingAgent(null);
        setStreamingSynthesis(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `synthesis-${Date.now()}`,
            type: "synthesis",
            agent: data.agent as CouncilAgent,
            content: data.content as string,
            responseTime: data.response_time as number,
            tokens: data.tokens as number,
            error: data.error as string | undefined,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "done":
        setTypingAgent(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `done-${Date.now()}`,
            type: "done",
            content: "",
            metrics: data.metrics as CouncilAgentMetric[],
            totalTime: data.total_time as number,
            totalTokens: data.total_tokens as number,
            timestamp: Date.now(),
          },
        ]);
        break;

      default:
        break;
    }
  }

  /* ── Start Debate ── */

  const startDebate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || debating) return;

    setDebating(true);
    setPrompt("");
    setTypingAgent(null);
    animatedIdsRef.current.clear();

    const userMsg: DebateMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages([userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/proxy/api/ai-council-debate", {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const eventData = JSON.parse(line.slice(6));
            handleSSEEvent(eventData);
          } catch {
            // skip malformed events
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith("data: ")) {
        try {
          const eventData = JSON.parse(buffer.slice(6));
          handleSSEEvent(eventData);
        } catch {
          // skip
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      showAlert(err instanceof Error ? err.message : "Debate failed");
    } finally {
      setDebating(false);
      setTypingAgent(null);
      setStreamingDebate(null);
      setStreamingSynthesis(null);
      abortRef.current = null;
    }
  }, [prompt, debating, token, showAlert]);

  const canSend = !debating && prompt.trim().length > 0;

  /* ── Render ── */

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[var(--text-muted)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">AI Council</span>
          <span className="hidden text-xs text-[var(--text-soft)] sm:inline">
            Sequential Debate
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle — only visible when there are messages */}
          {messages.length > 0 && (
            <div className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-alt)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("chat")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  viewMode === "chat"
                    ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <MessageSquare size={12} />
                Chat
              </button>
              <button
                type="button"
                onClick={() => setViewMode("tree")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  viewMode === "tree"
                    ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <GitBranch size={12} />
                Tree
              </button>
            </div>
          )}
          {debating && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-red-500 hover:bg-red-500/5"
            >
              <X size={12} />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Content area — chat or tree view */}
      {viewMode === "tree" && messages.length > 0 ? (
        <div className="min-h-0 flex-1">
          <DebateTreeView messages={messages} />
        </div>
      ) : (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="mx-auto flex max-w-4xl flex-col px-3 py-4 sm:px-6">
            {/* Empty state */}
            {messages.length === 0 && !debating && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <Users size={28} />
                </div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">AI Council Debate</h2>
                <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                  Submit a question and watch AI models debate sequentially — each agent responds
                  to previous arguments, agreeing or opposing in real time.
                </p>

                {/* Agent pills */}
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {Object.entries(AGENT_LABELS).map(([key, val]) => {
                    const colors = AGENT_COLORS[key];
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                      >
                        <AgentAvatar agent={key} size={18} />
                        <span className="text-[11px] font-medium" style={{ color: colors.text }}>
                          {val.name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Stance legend */}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {(Object.entries(STANCE_CONFIG) as [DebateStance, (typeof STANCE_CONFIG)[DebateStance]][]).map(
                    ([key, config]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
                        style={{ background: config.bg, color: config.color }}
                      >
                        <config.Icon size={8} />
                        {config.label}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => {
              const shouldAnimate = !animatedIdsRef.current.has(msg.id);
              if (shouldAnimate && (msg.type === "debate_response" || msg.type === "synthesis")) {
                animatedIdsRef.current.add(msg.id);
              }

              switch (msg.type) {
                case "user":
                  return (
                    <div key={msg.id} className="animate-fade-in flex justify-end py-2">
                      <div
                        className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-white select-text sm:max-w-[65%]"
                        style={{ background: BRAND_GRADIENT }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );

                case "debate_response":
                  return (
                    <DebateBubble
                      key={msg.id}
                      agent={msg.agent || "gpt"}
                      agentName={msg.agentName || "Agent"}
                      role={msg.agentRole || ""}
                      stance={msg.stance || "review"}
                      references={msg.references || []}
                      content={msg.content}
                      responseTime={msg.responseTime}
                      tokens={msg.tokens}
                      error={msg.error}
                      animate={shouldAnimate}
                    />
                  );

                case "synthesis":
                  return (
                    <SynthesisBubble
                      key={msg.id}
                      content={msg.content}
                      agent={msg.agent || "gpt"}
                      responseTime={msg.responseTime}
                      tokens={msg.tokens}
                      animate={shouldAnimate}
                    />
                  );

                case "done":
                  if (msg.metrics && msg.metrics.length > 0) {
                    return (
                      <MetricsCard
                        key={msg.id}
                        metrics={msg.metrics}
                        totalTime={msg.totalTime || 0}
                        totalTokens={msg.totalTokens || 0}
                      />
                    );
                  }
                  return null;

                default:
                  return null;
              }
            })}

            {/* Live streaming debate bubble */}
            {streamingDebate && streamingDebate.content.length > 0 && (
              <DebateBubble
                agent={streamingDebate.agent}
                agentName={streamingDebate.name}
                role={streamingDebate.role}
                stance={"initiate" as DebateStance}
                references={[]}
                content={streamingDebate.content}
                isStreaming={true}
              />
            )}

            {/* Live streaming synthesis bubble */}
            {streamingSynthesis && streamingSynthesis.content.length > 0 && (
              <SynthesisBubble
                content={streamingSynthesis.content}
                agent={streamingSynthesis.agent}
                isStreaming={true}
              />
            )}

            {/* Typing indicator */}
            {typingAgent && (
              <DebateTypingIndicator
                agent={typingAgent.agent}
                agentName={typingAgent.name}
                role={typingAgent.role}
                sequence={typingAgent.sequence}
                total={typingAgent.total}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-3 pb-3 pt-2 sm:px-4">
        <div className="mx-auto flex max-w-4xl items-end gap-2">
          <div className="flex min-h-[40px] flex-1 items-end rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--text-soft)] transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              disabled={debating}
              value={prompt}
              placeholder="Ask the AI Council to debate a topic..."
              className="max-h-[150px] min-h-[20px] w-full resize-none bg-transparent text-sm leading-5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)]"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) startDebate();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={startDebate}
            disabled={!canSend}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ background: canSend ? BRAND_GRADIENT : undefined }}
            aria-label="Start debate"
          >
            {debating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArrowUp size={16} />
            )}
          </button>
        </div>
        <p className="mx-auto mt-1.5 max-w-4xl text-center text-[10px] text-[var(--text-soft)]">
          AI agents will debate sequentially. Each agent responds to previous arguments. This may take 30-60 seconds.
        </p>
      </div>
    </div>
  );
}

export default CouncilWorkspace;
