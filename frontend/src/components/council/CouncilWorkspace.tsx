"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BarChart3,
  Clock,
  Cpu,
  Hash,
  Loader2,
  Trophy,
  Users,
  Vote,
  AlertTriangle,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useAuth } from "@/contexts/AuthContext";
import { useAlerts } from "@/contexts/AlertContext";
import { BRAND_GRADIENT, BRAND_NAME } from "@/lib/brand";
import { APP_NAME } from "@/lib/constants";
import type {
  CouncilAgent,
  CouncilAgentInfo,
  CouncilAgentMetric,
  CouncilMessage,
} from "@/lib/types";

/* ─── Agent visual config ─── */
const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gpt: { bg: "rgba(16,163,127,0.10)", text: "#10a37f", border: "rgba(16,163,127,0.25)" },
  gemini: { bg: "rgba(66,133,244,0.10)", text: "#4285f4", border: "rgba(66,133,244,0.25)" },
  claude: { bg: "rgba(217,119,6,0.10)", text: "#d97706", border: "rgba(217,119,6,0.25)" },
  grok: { bg: "rgba(239,68,68,0.10)", text: "#ef4444", border: "rgba(239,68,68,0.25)" },
};

const AGENT_LABELS: Record<string, { name: string; short: string }> = {
  gpt: { name: "GPT", short: "G" },
  gemini: { name: "Gemini", short: "Ge" },
  claude: { name: "Claude", short: "C" },
  grok: { name: "Grok", short: "Gr" },
};

const ROUND_LABELS: Record<number, string> = {
  1: "Round 1 — Initial Response",
  2: "Round 2 — Critique Phase",
  3: "Round 3 — Refinement",
  4: "Round 4 — Voting",
  5: "Round 5 — Final Synthesis",
};

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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{visibleContent}</ReactMarkdown>
    </div>
  );
}

/* ─── Sub-components ─── */

function AgentAvatar({ agent, size = 28 }: { agent: string; size?: number }) {
  const colors = AGENT_COLORS[agent] || AGENT_COLORS.gpt;
  const label = AGENT_LABELS[agent] || { short: "?" };
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: colors.text,
        fontSize: size * 0.36,
      }}
    >
      {label.short}
    </div>
  );
}

function RoundDivider({ round, name }: { round: number; name?: string }) {
  const label = name || ROUND_LABELS[round] || `Round ${round}`;
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-[var(--border)]" />
      <span className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        <Hash size={10} />
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

function TypingIndicator({ agent, role }: { agent: string; role: string }) {
  const colors = AGENT_COLORS[agent] || AGENT_COLORS.gpt;
  const label = AGENT_LABELS[agent] || { name: agent };
  return (
    <div className="animate-fade-in flex items-start gap-2.5 py-1.5">
      <AgentAvatar agent={agent} size={26} />
      <div>
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: colors.text }}>
            {label.name}
          </span>
          <span className="text-[10px] text-[var(--text-soft)]">{role}</span>
        </div>
        <div
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs"
          style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
        >
          <span className="typing-dot" style={{ background: colors.text }} />
          <span className="typing-dot" style={{ animationDelay: "0.15s", background: colors.text }} />
          <span className="typing-dot" style={{ animationDelay: "0.3s", background: colors.text }} />
        </div>
      </div>
    </div>
  );
}

function AgentBubble({
  agent,
  role,
  responseType,
  content,
  responseTime,
  tokens,
  error,
  animate,
}: {
  agent: string;
  role: string;
  responseType?: string;
  content: string;
  responseTime?: number;
  tokens?: number;
  error?: string;
  animate?: boolean;
}) {
  const colors = AGENT_COLORS[agent] || AGENT_COLORS.gpt;
  const label = AGENT_LABELS[agent] || { name: agent };
  const typeLabel =
    responseType === "critique"
      ? "Critique"
      : responseType === "refinement"
        ? "Refined Answer"
        : responseType === "vote"
          ? "Vote"
          : "";

  if (error) {
    return (
      <div className="animate-fade-in flex items-start gap-2.5 py-1.5">
        <AgentAvatar agent={agent} size={26} />
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold" style={{ color: colors.text }}>
              {label.name}
            </span>
            <span className="text-[10px] text-[var(--text-soft)]">{role}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-500">
            <AlertTriangle size={12} />
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex items-start gap-2.5 py-1.5">
      <AgentAvatar agent={agent} size={26} />
      <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
        <div className="mb-0.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold" style={{ color: colors.text }}>
            {label.name}
          </span>
          <span className="text-[10px] text-[var(--text-soft)]">{role}</span>
          {typeLabel && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase"
              style={{ background: colors.bg, color: colors.text }}
            >
              {typeLabel}
            </span>
          )}
        </div>
        <div
          className="rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-relaxed select-text"
          style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
        >
          {animate ? (
            <StreamingMarkdown content={content} />
          ) : (
            <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-1 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] prose-code:text-[var(--text-primary)] prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-soft)]">
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

function VoteResult({ votes, tally }: { votes: Record<string, string>; tally: Record<string, number> }) {
  const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a);
  return (
    <div className="animate-fade-in my-2 mx-auto max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
        <Vote size={14} />
        Vote Results
      </div>
      <div className="space-y-1.5">
        {sorted.map(([agent, count]) => {
          const colors = AGENT_COLORS[agent] || AGENT_COLORS.gpt;
          const label = AGENT_LABELS[agent] || { name: agent };
          const maxVotes = Math.max(...Object.values(tally));
          const isWinner = count === maxVotes;
          return (
            <div key={agent} className="flex items-center gap-2">
              <AgentAvatar agent={agent} size={20} />
              <span className="text-xs font-medium text-[var(--text-primary)] min-w-[50px]">
                {label.name}
              </span>
              <div className="flex-1 h-5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(5, (count / Math.max(Object.keys(votes).length, 1)) * 100)}%`,
                    background: colors.text,
                    opacity: isWinner ? 1 : 0.5,
                  }}
                />
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)] min-w-[24px] text-right">
                {count}
              </span>
              {isWinner && <Trophy size={12} className="text-yellow-500" />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-[var(--border)]">
        <div className="text-[10px] text-[var(--text-soft)]">
          {Object.entries(votes).map(([voter, voted]) => (
            <span key={voter} className="mr-2">
              {AGENT_LABELS[voter]?.name || voter} voted for{" "}
              <strong>{AGENT_LABELS[voted]?.name || voted}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SynthesisBubble({ content, agent, responseTime, tokens, animate }: {
  content: string;
  agent: string;
  responseTime?: number;
  tokens?: number;
  animate?: boolean;
}) {
  return (
    <div className="animate-fade-in my-2">
      <div className="rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 px-5 py-4">
        <div className="mb-2 flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" />
          <span className="text-sm font-bold text-[var(--text-primary)]">Final Synthesized Answer</span>
          <span className="text-[10px] text-[var(--text-soft)]">
            via {AGENT_LABELS[agent]?.name || agent}
          </span>
        </div>
        {animate ? (
          <StreamingMarkdown
            content={content}
            proseClass="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-1 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] select-text"
          />
        ) : (
          <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-p:my-1 prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] select-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-soft)]">
          {responseTime != null && (
            <span className="flex items-center gap-0.5"><Clock size={9} />{responseTime}s</span>
          )}
          {tokens != null && tokens > 0 && (
            <span className="flex items-center gap-0.5"><Cpu size={9} />~{tokens} tokens</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricsCard({ metrics, totalTime, totalTokens }: {
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
                <div className="flex justify-between">
                  <span>Votes</span>
                  <span className="font-medium text-[var(--text-primary)]">{m.votes_received}</span>
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

function CouncilWorkspace() {
  const { token } = useAuth();
  const { showAlert } = useAlerts();

  const [messages, setMessages] = useState<CouncilMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [debating, setDebating] = useState(false);
  const [typingAgents, setTypingAgents] = useState<{ agent: string; role: string }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const animatedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typingAgents]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  }, [prompt]);

  const startDebate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || debating) return;

    setDebating(true);
    setPrompt("");
    setTypingAgents([]);
    animatedIdsRef.current.clear();

    const userMsg: CouncilMessage = {
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

      const res = await fetch("/api/proxy/api/ai-council", {
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
            const data = JSON.parse(line.slice(6));
            handleSSEEvent(data);
          } catch {
            // skip malformed events
          }
        }
      }

      // Process remaining buffer
      if (buffer.startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.slice(6));
          handleSSEEvent(data);
        } catch {
          // skip
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      showAlert(err instanceof Error ? err.message : "Debate failed");
    } finally {
      setDebating(false);
      setTypingAgents([]);
      abortRef.current = null;
    }
  }, [prompt, debating, token, showAlert]);

  function handleSSEEvent(data: Record<string, unknown>) {
    const type = data.type as string;

    switch (type) {
      case "council_start":
        // Council started; agents info available
        break;

      case "round_start": {
        const round = data.round as number;
        const name = data.name as string;
        setMessages((prev) => [
          ...prev,
          {
            id: `divider-${round}-${Date.now()}`,
            type: "round_divider",
            round,
            roundName: name,
            content: "",
            timestamp: Date.now(),
          },
        ]);
        break;
      }

      case "agent_typing":
        setTypingAgents((prev) => {
          const exists = prev.some((t) => t.agent === data.agent);
          if (exists) return prev;
          return [...prev, { agent: data.agent as string, role: data.role as string }];
        });
        break;

      case "agent_response":
        // Remove typing indicator for this agent
        setTypingAgents((prev) => prev.filter((t) => t.agent !== data.agent));
        setMessages((prev) => [
          ...prev,
          {
            id: `agent-${data.agent}-r${data.round}-${Date.now()}`,
            type: "agent_response",
            agent: data.agent as CouncilAgent,
            agentRole: data.role as string,
            round: data.round as number,
            responseType: data.response_type as string,
            content: data.content as string,
            responseTime: data.response_time as number,
            tokens: data.tokens as number,
            error: data.error as string | undefined,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "round_end":
        setTypingAgents([]);
        break;

      case "vote_result":
        setMessages((prev) => [
          ...prev,
          {
            id: `vote-${Date.now()}`,
            type: "vote_result",
            content: "",
            votes: data.votes as Record<string, string>,
            tally: data.tally as Record<string, number>,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "synthesis":
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
        setTypingAgents([]);
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

  const canSend = !debating && prompt.trim().length > 0;

  return (
    <div className="flex h-[calc(100dvh-49px)] w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[var(--text-muted)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">AI Council</span>
          <span className="hidden text-xs text-[var(--text-soft)] sm:inline">
            Multi-Agent Debate
          </span>
        </div>
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

      {/* Messages */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        <div className="mx-auto flex max-w-4xl flex-col px-3 py-4 sm:px-6">
          {messages.length === 0 && !debating && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white"
                style={{ background: BRAND_GRADIENT }}
              >
                <Users size={28} />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">AI Council</h2>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
                Submit a prompt and watch multiple AI models debate, critique, refine, and
                synthesize the best answer.
              </p>
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
            </div>
          )}

          {messages.map((msg) => {
            // Determine if this message should animate (first time rendering)
            const shouldAnimate = !animatedIdsRef.current.has(msg.id);
            if (shouldAnimate && (msg.type === "agent_response" || msg.type === "synthesis")) {
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

              case "round_divider":
                return (
                  <RoundDivider
                    key={msg.id}
                    round={msg.round || 0}
                    name={msg.roundName}
                  />
                );

              case "agent_response":
                return (
                  <AgentBubble
                    key={msg.id}
                    agent={msg.agent || "gpt"}
                    role={msg.agentRole || ""}
                    responseType={msg.responseType}
                    content={msg.content}
                    responseTime={msg.responseTime}
                    tokens={msg.tokens}
                    error={msg.error}
                    animate={shouldAnimate}
                  />
                );

              case "vote_result":
                return (
                  <VoteResult
                    key={msg.id}
                    votes={msg.votes || {}}
                    tally={msg.tally || {}}
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

          {/* Typing indicators */}
          {typingAgents.map((t) => (
            <TypingIndicator key={`typing-${t.agent}`} agent={t.agent} role={t.role} />
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-3 pb-3 pt-2 sm:px-4">
        <div className="mx-auto flex max-w-4xl items-end gap-2">
          <div className="flex min-h-[40px] flex-1 items-end rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--text-soft)] transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              disabled={debating}
              value={prompt}
              placeholder="Ask the AI Council a question..."
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
          AI Council runs 5 debate rounds across multiple models. This may take 15-30 seconds.
        </p>
      </div>
    </div>
  );
}

export default CouncilWorkspace;
