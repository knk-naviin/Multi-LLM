"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Code,
  Shield,
  Zap,
  HelpCircle,
  TestTube2,
  MessageSquare,
  Cpu,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { sharedMarkdownComponents } from "@/components/ui/MarkdownRenderer";
import { BRAND_GRADIENT } from "@/lib/brand";
import { useAuth } from "@/contexts/AuthContext";
import { useAlerts } from "@/contexts/AlertContext";
import { apiRequest } from "@/lib/api";
import type { FollowUpMessage, TaskFollowUpResponse } from "@/lib/types";

/* ─── Quick Action Buttons ─── */

const QUICK_ACTIONS = [
  {
    label: "Improve Code",
    icon: Code,
    prompt: "Please improve the code quality, readability, and organization.",
  },
  {
    label: "Add Error Handling",
    icon: Shield,
    prompt: "Add comprehensive error handling and input validation to the code.",
  },
  {
    label: "Optimize Performance",
    icon: Zap,
    prompt: "Optimize this code for better performance and efficiency.",
  },
  {
    label: "Explain Code",
    icon: HelpCircle,
    prompt: "Explain the code in detail, section by section.",
  },
  {
    label: "Add Tests",
    icon: TestTube2,
    prompt: "Write comprehensive unit tests for this code.",
  },
];

/* ─── Props ─── */

interface TaskFollowUpChatProps {
  workflowId: string;
  taskType: string;
  initialMessages?: FollowUpMessage[];
}

export function TaskFollowUpChat({
  workflowId,
  taskType,
  initialMessages = [],
}: TaskFollowUpChatProps) {
  const [messages, setMessages] = useState<FollowUpMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { token } = useAuth();
  const { showAlert } = useAlerts();
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initialMessages if they change (e.g., loading a different workflow)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  // Send message
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !token || !workflowId || isLoading) return;

      // Optimistically add user message
      const userMsg: FollowUpMessage = {
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const result = await apiRequest<TaskFollowUpResponse>(
          "/api/task-followup",
          {
            method: "POST",
            token,
            body: {
              task_id: workflowId,
              message: trimmed,
            },
          }
        );

        const assistantMsg: FollowUpMessage = {
          role: "assistant",
          content: result.reply,
          model_used: result.model_used,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        showAlert(
          err instanceof Error
            ? err.message
            : "Failed to get follow-up response"
        );
        // Remove the optimistic user message on failure
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [token, workflowId, isLoading, showAlert]
  );

  const showQuickActions = messages.length === 0;
  const canSend = !isLoading && input.trim().length > 0 && !!token;

  // Determine quick action set based on task type
  const _taskType = taskType;
  void _taskType; // Future: swap quick actions per task type

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-5">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare size={14} className="text-[var(--brand)]" />
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Follow-Up Chat
        </h3>
      </div>

      <p className="mb-4 text-[11px] text-[var(--text-soft)]">
        Ask questions or request improvements to this task output.
      </p>

      {/* Quick action buttons (shown only when chat is empty) */}
      {showQuickActions && (
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => sendMessage(action.prompt)}
                disabled={!token || isLoading}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)] hover:border-[var(--brand)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon size={12} />
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Message thread */}
      {messages.length > 0 && (
        <div className="mb-4 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
          {messages.map((msg, idx) => (
            <div key={`${msg.role}-${idx}`} className="animate-fade-in">
              {msg.role === "user" ? (
                /* User message */
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-white select-text"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    {msg.content}
                  </div>
                </div>
              ) : (
                /* Assistant message */
                <div>
                  <div className="prose prose-sm max-w-none select-text break-words text-[var(--text-primary)] prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={sharedMarkdownComponents}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {msg.model_used && (
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-soft)]">
                      <Cpu size={9} />
                      <span className="font-medium uppercase">
                        {msg.model_used}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 py-2 animate-fade-in">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-soft)]" />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-soft)]"
                  style={{ animationDelay: "0.1s" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-soft)]"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
              <span className="text-[11px] text-[var(--text-soft)]">
                Thinking...
              </span>
            </div>
          )}

          <div ref={endRef} />
        </div>
      )}

      {/* Input area */}
      {token ? (
        <div className="flex items-end gap-2">
          <div className="flex min-h-[40px] flex-1 items-end rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 focus-within:border-[var(--text-soft)] transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              disabled={isLoading}
              value={input}
              placeholder="Ask a follow-up question..."
              className="max-h-[120px] min-h-[20px] w-full resize-none bg-transparent text-sm leading-5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)] disabled:opacity-50"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && canSend) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!canSend}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{
              background: canSend ? BRAND_GRADIENT : "var(--surface-alt)",
            }}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      ) : (
        <p className="text-center text-[11px] text-[var(--text-soft)]">
          Sign in to use follow-up chat.
        </p>
      )}
    </div>
  );
}
