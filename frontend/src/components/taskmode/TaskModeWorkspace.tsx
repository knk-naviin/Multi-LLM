"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Layers, Play, RotateCcw, Square, History, Film, X } from "lucide-react";

import { TaskChipSelector } from "@/components/chat/TaskChipSelector";
import { AgentRoleSelector } from "@/components/chat/AgentRoleSelector";
import { TaskExecutionTimeline } from "@/components/taskmode/TaskExecutionTimeline";
import { AgentConversationPanel } from "@/components/taskmode/AgentConversationPanel";
import { TaskReplayPlayer } from "@/components/taskmode/TaskReplayPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { useAlerts } from "@/contexts/AlertContext";
import { apiRequest } from "@/lib/api";
import { BRAND_GRADIENT } from "@/lib/brand";
import type {
  AgentConversationMessage,
  TaskTypeConfig,
  TaskWorkflowSummary,
  TaskWorkflowFull,
  TimelineStep,
} from "@/lib/types";

/* ─── Session persistence ─── */

const SESSION_TASK_STATE = "swastik.task.state";

interface TaskSessionState {
  taskPrompt: string;
  selectedType: string | null;
  agents: Record<string, string>;
  timelineSteps: TimelineStep[];
  agentMessages: AgentConversationMessage[];
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
}

function saveTaskSession(state: TaskSessionState) {
  try {
    sessionStorage.setItem(SESSION_TASK_STATE, JSON.stringify(state));
  } catch {
    // sessionStorage might be unavailable
  }
}

function loadTaskSession(): TaskSessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_TASK_STATE);
    return raw ? (JSON.parse(raw) as TaskSessionState) : null;
  } catch {
    return null;
  }
}

function clearTaskSession() {
  try {
    sessionStorage.removeItem(SESSION_TASK_STATE);
  } catch {
    // ignore
  }
}

/* ─── Static task type definitions (same as TaskModePanel) ─── */
const TASK_TYPES: TaskTypeConfig[] = [
  {
    key: "coding",
    label: "Coding",
    icon: "Code",
    roles: [
      { key: "coder", label: "Coding Agent", description: "Writes the initial code" },
      { key: "reviewer", label: "Code Reviewer", description: "Reviews and suggests improvements" },
      { key: "qc", label: "QC Agent", description: "Checks bugs, performance, best practices" },
    ],
  },
  {
    key: "content_writing",
    label: "Content Writing",
    icon: "FileText",
    roles: [
      { key: "writer", label: "Writer Agent", description: "Writes the initial content" },
      { key: "editor", label: "Editor Agent", description: "Edits and improves content" },
      { key: "quality_reviewer", label: "Quality Reviewer", description: "Final quality review" },
    ],
  },
  {
    key: "story_building",
    label: "Story Building",
    icon: "BookOpen",
    roles: [
      { key: "story_creator", label: "Story Creator", description: "Creates the initial story" },
      { key: "plot_improver", label: "Plot Improver", description: "Improves plot and narrative" },
      { key: "style_editor", label: "Style Editor", description: "Polishes prose style" },
    ],
  },
  {
    key: "research",
    label: "Research",
    icon: "Search",
    roles: [
      { key: "researcher", label: "Research Agent", description: "Conducts thorough research" },
      { key: "fact_checker", label: "Fact Checker", description: "Verifies facts and claims" },
      { key: "summarizer", label: "Summary Agent", description: "Summarizes findings" },
    ],
  },
  {
    key: "data_analysis",
    label: "Data Analysis",
    icon: "BarChart",
    roles: [
      { key: "analyst", label: "Analysis Agent", description: "Analyzes the data" },
      { key: "validator", label: "Validation Agent", description: "Validates findings" },
      { key: "reporter", label: "Report Agent", description: "Creates a clear report" },
    ],
  },
  {
    key: "debugging",
    label: "Debugging",
    icon: "Bug",
    roles: [
      { key: "debugger", label: "Debug Agent", description: "Finds and identifies bugs" },
      { key: "fixer", label: "Fix Agent", description: "Proposes and implements fixes" },
      { key: "tester", label: "Test Agent", description: "Verifies fixes and suggests tests" },
    ],
  },
];

/* ─── Component ─── */

function TaskModeWorkspace() {
  const { token } = useAuth();
  const { showAlert } = useAlerts();

  // ── Configuration state ──
  const [taskPrompt, setTaskPrompt] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [agents, setAgents] = useState<Record<string, string>>({});

  // ── Execution state ──
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentConversationMessage[]>([]);
  const [finalResult, setFinalResult] = useState<{
    content: string;
    agent?: string;
    agentName?: string;
    responseTime?: number;
    tokens?: number;
  } | null>(null);
  const [totalTime, setTotalTime] = useState<number | undefined>();
  const [totalTokens, setTotalTokens] = useState<number | undefined>();

  // ── Replay & History state ──
  const [showReplay, setShowReplay] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<TaskWorkflowSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const selectedConfig = TASK_TYPES.find((t) => t.key === selectedType);

  // ── Restore session on mount ──
  useEffect(() => {
    const saved = loadTaskSession();
    if (saved && (saved.timelineSteps.length > 0 || saved.isComplete)) {
      setTaskPrompt(saved.taskPrompt);
      setSelectedType(saved.selectedType);
      setAgents(saved.agents);
      setTimelineSteps(saved.timelineSteps);
      setAgentMessages(saved.agentMessages);
      setFinalResult(saved.finalResult);
      setTotalTime(saved.totalTime);
      setTotalTokens(saved.totalTokens);
      setIsComplete(saved.isComplete);
      setWorkflowId(saved.workflowId ?? null);
    }
  }, []);

  // ── Fetch workflow history ──
  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const data = await apiRequest<{ workflows: TaskWorkflowSummary[] }>("/api/task-workflows?limit=20", { token });
      setWorkflowHistory(data.workflows || []);
    } catch {
      // silently fail
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  // ── Load a workflow from history for replay ──
  const loadWorkflowForReplay = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        const data = await apiRequest<{ workflow: TaskWorkflowFull }>(`/api/task-workflows/${id}`, { token });
        const wf = data.workflow;
        if (!wf) return;

        // Parse events into timeline steps and agent messages
        const steps: TimelineStep[] = [];
        const msgs: AgentConversationMessage[] = [];
        let fr: typeof finalResult = null;

        for (const evt of wf.events) {
          const type = evt.type as string;
          if (type === "step_complete") {
            const stepId = `${evt.step}-iter-${evt.iteration}`;
            steps.push({
              id: stepId,
              step: evt.step as string,
              stepLabel: evt.step_label as string,
              agent: evt.agent as string,
              agentName: evt.agent_name as string,
              iteration: evt.iteration as number,
              status: evt.error ? "failed" : "completed",
              content: evt.content as string,
              responseTime: evt.response_time as number,
              tokens: evt.tokens as number,
              error: evt.error as string | undefined,
            });
            msgs.push({
              id: `${evt.step}-${evt.iteration}-${Date.now()}-${Math.random()}`,
              step: evt.step as string,
              stepLabel: evt.step_label as string,
              agent: evt.agent as string,
              agentName: evt.agent_name as string,
              content: evt.content as string,
              responseTime: evt.response_time as number,
              tokens: evt.tokens as number,
              error: evt.error as string | undefined,
              iteration: evt.iteration as number,
            });
          } else if (type === "review_feedback" || type === "qc_feedback") {
            steps.push({
              id: `${type}-${evt.iteration}-${Date.now()}`,
              step: type,
              stepLabel: type === "review_feedback" ? "Revision Requested" : "QC Revision Required",
              agent: "",
              iteration: evt.iteration as number,
              status: "revision",
              feedbackMessage: evt.message as string,
            });
          } else if (type === "review_approved" || type === "qc_passed") {
            steps.push({
              id: `${type}-${evt.iteration}-${Date.now()}`,
              step: type,
              stepLabel: type === "review_approved" ? "Review Approved" : "QC Passed",
              agent: "",
              iteration: evt.iteration as number,
              status: "completed",
              feedbackMessage: evt.message as string,
            });
          } else if (type === "final_result") {
            fr = {
              content: evt.content as string,
              agent: evt.agent as string,
              agentName: evt.agent_name as string,
              responseTime: evt.response_time as number,
              tokens: evt.tokens as number,
            };
            steps.push({
              id: `final-synthesis-replay`,
              step: "final_synthesis",
              stepLabel: "Final Result Ready",
              agent: evt.agent as string,
              agentName: evt.agent_name as string,
              iteration: 1,
              status: "completed",
            });
          }
        }

        setTaskPrompt(wf.task_prompt);
        setSelectedType(wf.task_type);
        setAgents(wf.agents);
        setTimelineSteps(steps);
        setAgentMessages(msgs);
        setFinalResult(fr);
        setTotalTime(wf.total_time);
        setTotalTokens(wf.total_tokens);
        setIsComplete(true);
        setIsRunning(false);
        setWorkflowId(wf.id);
        setHistoryOpen(false);
        setShowReplay(true);
      } catch {
        showAlert("Failed to load workflow for replay");
      }
    },
    [token, showAlert]
  );

  // Reset agent assignments when task type changes
  useEffect(() => {
    if (selectedConfig) {
      const defaults: Record<string, string> = {};
      const agentKeys = ["gpt", "gemini", "claude", "grok"];
      selectedConfig.roles.forEach((role, idx) => {
        defaults[role.key] = agentKeys[idx % agentKeys.length];
      });
      setAgents(defaults);
    } else {
      setAgents({});
    }
  }, [selectedType, selectedConfig]);

  const canSubmit =
    !isRunning &&
    taskPrompt.trim().length > 0 &&
    selectedType !== null &&
    selectedConfig !== undefined;

  // ── SSE Event Handler ──
  const handleSSEEvent = useCallback((data: Record<string, unknown>) => {
    const type = data.type as string;

    switch (type) {
      case "workflow_start":
        // Workflow has started — configuration is confirmed
        break;

      case "step_start": {
        const stepId = `${data.step}-iter-${data.iteration}`;
        setTimelineSteps((prev) => {
          const existing = prev.find((s) => s.id === stepId);
          if (existing) {
            return prev.map((s) =>
              s.id === stepId ? { ...s, status: "in_progress" as const } : s
            );
          }
          return [
            ...prev,
            {
              id: stepId,
              step: data.step as string,
              stepLabel: data.step_label as string,
              agent: data.agent as string,
              iteration: data.iteration as number,
              status: "in_progress" as const,
            },
          ];
        });
        break;
      }

      case "step_complete": {
        const stepId = `${data.step}-iter-${data.iteration}`;
        setTimelineSteps((prev) => {
          const updated = prev.map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  status: data.error ? ("failed" as const) : ("completed" as const),
                  agentName: data.agent_name as string,
                  content: data.content as string,
                  responseTime: data.response_time as number,
                  tokens: data.tokens as number,
                  error: data.error as string | undefined,
                }
              : s
          );
          return updated;
        });

        // Add to agent conversation
        setAgentMessages((prev) => [
          ...prev,
          {
            id: `${data.step}-${data.iteration}-${Date.now()}`,
            step: data.step as string,
            stepLabel: data.step_label as string,
            agent: data.agent as string,
            agentName: data.agent_name as string,
            content: data.content as string,
            responseTime: data.response_time as number,
            tokens: data.tokens as number,
            error: data.error as string | undefined,
            iteration: data.iteration as number,
          },
        ]);
        break;
      }

      case "review_feedback":
        setTimelineSteps((prev) => [
          ...prev,
          {
            id: `review-feedback-${data.iteration}-${Date.now()}`,
            step: "review_feedback",
            stepLabel: "Revision Requested",
            agent: "",
            iteration: data.iteration as number,
            status: "revision" as const,
            feedbackMessage: data.message as string,
          },
        ]);
        break;

      case "review_approved":
        setTimelineSteps((prev) => [
          ...prev,
          {
            id: `review-approved-${data.iteration}-${Date.now()}`,
            step: "review_approved",
            stepLabel: "Review Approved",
            agent: "",
            iteration: data.iteration as number,
            status: "completed" as const,
            feedbackMessage: data.message as string,
          },
        ]);
        break;

      case "qc_feedback":
        setTimelineSteps((prev) => [
          ...prev,
          {
            id: `qc-feedback-${data.iteration}-${Date.now()}`,
            step: "qc_feedback",
            stepLabel: "QC Revision Required",
            agent: "",
            iteration: data.iteration as number,
            status: "revision" as const,
            feedbackMessage: data.message as string,
          },
        ]);
        break;

      case "qc_passed":
        setTimelineSteps((prev) => [
          ...prev,
          {
            id: `qc-passed-${data.iteration}-${Date.now()}`,
            step: "qc_passed",
            stepLabel: "QC Passed",
            agent: "",
            iteration: data.iteration as number,
            status: "completed" as const,
            feedbackMessage: data.message as string,
          },
        ]);
        break;

      case "final_result":
        setFinalResult({
          content: data.content as string,
          agent: data.agent as string,
          agentName: data.agent_name as string,
          responseTime: data.response_time as number,
          tokens: data.tokens as number,
        });
        setTimelineSteps((prev) => [
          ...prev,
          {
            id: `final-synthesis-${Date.now()}`,
            step: "final_synthesis",
            stepLabel: "Final Result Ready",
            agent: data.agent as string,
            agentName: data.agent_name as string,
            iteration: 1,
            status: "completed" as const,
          },
        ]);
        break;

      case "done":
        setIsRunning(false);
        setIsComplete(true);
        setTotalTime(data.total_time as number);
        setTotalTokens(data.total_tokens as number);
        break;

      case "workflow_saved":
        setWorkflowId(data.workflow_id as string);
        break;

      case "error":
        showAlert(data.message as string || "Workflow error occurred");
        setIsRunning(false);
        break;
    }
  }, [showAlert]);

  // ── Persist to sessionStorage whenever execution state changes ──
  useEffect(() => {
    if (timelineSteps.length === 0 && !isComplete) return;
    saveTaskSession({
      taskPrompt,
      selectedType,
      agents,
      timelineSteps,
      agentMessages,
      finalResult,
      totalTime,
      totalTokens,
      isComplete,
      workflowId,
    });
  }, [timelineSteps, agentMessages, finalResult, isComplete, totalTime, totalTokens, taskPrompt, selectedType, agents, workflowId]);

  // ── Start Workflow ──
  const startWorkflow = useCallback(async () => {
    if (!canSubmit) return;

    // Reset execution state
    setIsRunning(true);
    setIsComplete(false);
    setTimelineSteps([]);
    setAgentMessages([]);
    setFinalResult(null);
    setTotalTime(undefined);
    setTotalTokens(undefined);

    const controller = new AbortController();
    abortRef.current = controller;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch("/api/proxy/api/task-workflow", {
        method: "POST",
        headers,
        body: JSON.stringify({
          task_prompt: taskPrompt.trim(),
          task_type: selectedType,
          agents,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || errBody.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

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
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        showAlert("Workflow stopped.", "info");
      } else {
        showAlert((err as Error).message || "Failed to run workflow");
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [canSubmit, taskPrompt, selectedType, agents, token, handleSSEEvent, showAlert]);

  const stopWorkflow = () => {
    abortRef.current?.abort();
  };

  const resetWorkflow = () => {
    setIsRunning(false);
    setIsComplete(false);
    setTimelineSteps([]);
    setAgentMessages([]);
    setFinalResult(null);
    setTotalTime(undefined);
    setTotalTokens(undefined);
    setShowReplay(false);
    setWorkflowId(null);
    clearTaskSession();
  };

  const hasExecution = timelineSteps.length > 0 || isRunning;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md text-white"
            style={{ background: BRAND_GRADIENT }}
          >
            <Layers size={12} />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Task Mode</span>
          <span className="hidden text-[10px] text-[var(--text-soft)] sm:inline">
            Transparent AI Workflow
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              type="button"
              onClick={stopWorkflow}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-500 transition hover:bg-red-500/20"
            >
              <Square size={10} />
              Stop
            </button>
          )}
          {isComplete && !showReplay && (
            <button
              type="button"
              onClick={() => setShowReplay(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--brand)] transition hover:bg-[var(--brand)]/20"
            >
              <Film size={10} />
              Replay
            </button>
          )}
          {isComplete && showReplay && (
            <button
              type="button"
              onClick={() => setShowReplay(false)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)]"
            >
              <X size={10} />
              Exit Replay
            </button>
          )}
          {isComplete && (
            <button
              type="button"
              onClick={resetWorkflow}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)]"
            >
              <RotateCcw size={10} />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      {!hasExecution ? (
        /* ── Configuration Panel ── */
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* History sidebar */}
          {token && (
            <div
              className={`shrink-0 border-r border-[var(--border)] overflow-y-auto custom-scrollbar transition-all duration-200 ${
                historyOpen ? "w-[280px]" : "w-0"
              }`}
            >
              {historyOpen && (
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      History
                    </h3>
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(false)}
                      className="text-[var(--text-soft)] hover:text-[var(--text-primary)]"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {loadingHistory ? (
                    <p className="text-[11px] text-[var(--text-soft)]">Loading...</p>
                  ) : workflowHistory.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-soft)]">No history yet</p>
                  ) : (
                    <div className="space-y-2">
                      {workflowHistory.map((wf) => (
                        <button
                          key={wf.id}
                          type="button"
                          onClick={() => loadWorkflowForReplay(wf.id)}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-left transition hover:bg-[var(--surface-alt)]"
                        >
                          <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                            {wf.task_prompt}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                              {wf.task_label}
                            </span>
                            <span className="text-[9px] text-[var(--text-soft)]">
                              {wf.total_time.toFixed(1)}s
                            </span>
                            <span className={`text-[9px] font-medium ${wf.status === "completed" ? "text-green-500" : "text-red-500"}`}>
                              {wf.status}
                            </span>
                          </div>
                          {wf.created_at && (
                            <p className="mt-0.5 text-[9px] text-[var(--text-soft)]">
                              {new Date(wf.created_at).toLocaleDateString()}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
              {/* Hero section */}
              <div className="mb-8 text-center">
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  <Layers size={22} />
                </div>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">
                  AI Team Workflow
                </h1>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Define your task, assign AI agents to roles, and watch them work transparently.
                </p>
              </div>

              {/* History button */}
              {token && !historyOpen && (
                <div className="mb-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryOpen(true);
                      fetchHistory();
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)]"
                  >
                    <History size={12} />
                    View History
                  </button>
                </div>
              )}

              {/* Task Description */}
              <div className="mb-5">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Task Description
                </label>
                <textarea
                  rows={3}
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  placeholder='e.g. "Build a REST API login system using Node.js and JWT authentication."'
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)] focus:border-[var(--text-soft)] transition-colors resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && canSubmit) {
                      e.preventDefault();
                      startWorkflow();
                    }
                  }}
                />
              </div>

              {/* Task Type Chips */}
              <div className="mb-5">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Task Type
                </label>
                <TaskChipSelector
                  taskTypes={TASK_TYPES}
                  selected={selectedType}
                  onSelect={setSelectedType}
                />
              </div>

              {/* Agent Role Assignment */}
              {selectedConfig && (
                <div className="mb-6 animate-fade-in">
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Agent Assignment
                  </label>
                  <AgentRoleSelector
                    roles={selectedConfig.roles}
                    assignments={agents}
                    onAssign={(roleKey, agentKey) =>
                      setAgents((prev) => ({ ...prev, [roleKey]: agentKey }))
                    }
                  />
                </div>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={startWorkflow}
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: canSubmit ? BRAND_GRADIENT : undefined }}
              >
                <Play size={15} />
                Start Workflow
              </button>

              <p className="mt-2 text-center text-[10px] text-[var(--text-soft)]">
                Agents will run with iterative review loops. This may take 1-3 minutes.
              </p>
            </div>
          </div>
        </div>
      ) : showReplay && isComplete ? (
        /* ── Replay View ── */
        <TaskReplayPlayer
          agentMessages={agentMessages}
          timelineSteps={timelineSteps}
          finalResult={finalResult}
          totalTime={totalTime}
          totalTokens={totalTokens}
        />
      ) : (
        /* ── Execution View (Two-panel layout) ── */
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left: Timeline */}
          <div className="hidden w-[280px] shrink-0 border-r border-[var(--border)] overflow-y-auto custom-scrollbar sm:block">
            <TaskExecutionTimeline steps={timelineSteps} isRunning={isRunning} />
          </div>

          {/* Right: Agent Conversation */}
          <div className="min-w-0 flex-1 overflow-y-auto custom-scrollbar">
            {/* Mobile: inline timeline at top */}
            <div className="border-b border-[var(--border)] sm:hidden">
              <TaskExecutionTimeline steps={timelineSteps} isRunning={isRunning} />
            </div>

            <AgentConversationPanel
              messages={agentMessages}
              finalResult={finalResult}
              totalTime={totalTime}
              totalTokens={totalTokens}
              isComplete={isComplete}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskModeWorkspace;
