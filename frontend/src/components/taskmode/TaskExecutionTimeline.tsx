"use client";

import { useEffect, useRef } from "react";
import { Check, CheckSquare, Loader2, RotateCcw, Square, X, AlertTriangle, ChevronRight } from "lucide-react";
import type { TimelineStep } from "@/lib/types";

const AGENT_COLORS: Record<string, string> = {
  gpt: "#10a37f",
  gemini: "#4285f4",
  claude: "#d97706",
  grok: "#ef4444",
};

/* ── Checkbox-style status icons ── */

function StepStatusIcon({ status }: { status: TimelineStep["status"] }) {
  switch (status) {
    case "completed":
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded text-green-500">
          <CheckSquare size={14} />
        </div>
      );
    case "in_progress":
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded text-[var(--brand)]">
          <Loader2 size={14} className="animate-spin" />
        </div>
      );
    case "failed":
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded text-red-500">
          <X size={14} />
        </div>
      );
    case "revision":
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded text-yellow-500">
          <AlertTriangle size={13} />
        </div>
      );
    default:
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-soft)]">
          <Square size={14} />
        </div>
      );
  }
}

/* ── Workflow Progress Bar ── */

function WorkflowProgressBar({ steps, isRunning }: { steps: TimelineStep[]; isRunning: boolean }) {
  const completed = steps.filter((s) => s.status === "completed").length;
  const total = steps.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Determine current phase
  const hasQCStep = steps.some((s) => s.step.includes("qc") || s.step === "qc_feedback" || s.step === "qc_passed");
  const hasFinal = steps.some((s) => s.step === "final_synthesis");
  let phaseLabel = "Phase 1: Review Loop";
  if (hasFinal) phaseLabel = "Phase 3: Synthesis";
  else if (hasQCStep) phaseLabel = "Phase 2: QC Validation";

  const barColor = isRunning ? "var(--brand)" : percentage === 100 ? "#22c55e" : "var(--brand)";

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium text-[var(--text-muted)]">{phaseLabel}</span>
        <span className="text-[10px] font-medium text-[var(--text-soft)]">{percentage}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

/* ── Event Log ── */

function WorkflowEventLog({ steps }: { steps: TimelineStep[] }) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [steps.length]);

  const events = steps
    .filter((s) => s.status !== "pending")
    .map((s) => {
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      let label = s.stepLabel;
      if (s.status === "completed" && s.responseTime != null) {
        label += ` (${s.responseTime.toFixed(1)}s)`;
      }
      if (s.agentName) {
        label += ` — ${s.agentName}`;
      }
      return { id: s.id, time, label, status: s.status };
    });

  if (events.length === 0) return null;

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <h4 className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        <ChevronRight size={10} />
        Event Log
      </h4>
      <div ref={logRef} className="max-h-[120px] overflow-y-auto custom-scrollbar space-y-0.5">
        {events.map((evt) => (
          <div key={evt.id} className="flex items-start gap-2 text-[9px] leading-relaxed">
            <span className="shrink-0 font-mono text-[var(--text-soft)]">{evt.time}</span>
            <span
              className={
                evt.status === "completed"
                  ? "text-green-500"
                  : evt.status === "revision"
                  ? "text-yellow-500"
                  : evt.status === "failed"
                  ? "text-red-500"
                  : "text-[var(--text-muted)]"
              }
            >
              {evt.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Phase grouping helper ── */

interface PhaseGroup {
  label: string;
  steps: TimelineStep[];
  status: "completed" | "in_progress" | "pending";
}

function groupStepsIntoPhases(steps: TimelineStep[]): PhaseGroup[] {
  const phases: PhaseGroup[] = [];

  const reviewSteps: TimelineStep[] = [];
  const qcSteps: TimelineStep[] = [];
  const synthesisSteps: TimelineStep[] = [];

  for (const step of steps) {
    if (step.step === "final_synthesis") {
      synthesisSteps.push(step);
    } else if (
      step.step.includes("qc") ||
      step.step === "qc_feedback" ||
      step.step === "qc_passed"
    ) {
      qcSteps.push(step);
    } else {
      reviewSteps.push(step);
    }
  }

  const phaseStatus = (items: TimelineStep[]): PhaseGroup["status"] => {
    if (items.length === 0) return "pending";
    if (items.some((s) => s.status === "in_progress")) return "in_progress";
    if (items.every((s) => s.status === "completed" || s.status === "revision")) return "completed";
    return "in_progress";
  };

  if (reviewSteps.length > 0) {
    phases.push({ label: "Developer ↔ Reviewer", steps: reviewSteps, status: phaseStatus(reviewSteps) });
  }
  if (qcSteps.length > 0) {
    phases.push({ label: "QC Validation", steps: qcSteps, status: phaseStatus(qcSteps) });
  }
  if (synthesisSteps.length > 0) {
    phases.push({ label: "Final Synthesis", steps: synthesisSteps, status: phaseStatus(synthesisSteps) });
  }

  return phases;
}

/* ── Main Timeline Component ── */

interface TaskExecutionTimelineProps {
  steps: TimelineStep[];
  isRunning?: boolean;
}

export function TaskExecutionTimeline({ steps, isRunning = false }: TaskExecutionTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <Loader2 size={20} className="mx-auto mb-2 animate-spin text-[var(--text-soft)]" />
          <p className="text-xs text-[var(--text-soft)]">Starting workflow...</p>
        </div>
      </div>
    );
  }

  const phases = groupStepsIntoPhases(steps);

  return (
    <div className="p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Live Monitor
      </h3>

      {/* Progress Bar */}
      <WorkflowProgressBar steps={steps} isRunning={isRunning} />

      {/* Phase-grouped steps */}
      <div className="space-y-3">
        {phases.map((phase) => (
          <div key={phase.label}>
            {/* Phase header */}
            <div className="mb-2 flex items-center gap-2">
              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  phase.status === "completed"
                    ? "bg-green-500"
                    : phase.status === "in_progress"
                    ? "bg-[var(--brand)] animate-pulse"
                    : "bg-[var(--text-soft)]"
                }`}
              />
              <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                {phase.label}
              </span>
              <span className="text-[9px] text-[var(--text-soft)]">
                ({phase.steps.filter((s) => s.status === "completed").length}/{phase.steps.length})
              </span>
            </div>

            {/* Steps in phase */}
            <div className="relative ml-0.5 space-y-0">
              {phase.steps.map((step, idx) => {
                const agentColor = AGENT_COLORS[step.agent] || "#6b7280";
                const isLast = idx === phase.steps.length - 1;

                return (
                  <div key={step.id} className="relative flex gap-2.5 animate-fade-in">
                    {/* Vertical connector */}
                    {!isLast && (
                      <div
                        className="absolute left-[9px] top-[22px] w-px bg-[var(--border)]"
                        style={{ height: "calc(100% - 2px)" }}
                      />
                    )}

                    {/* Checkbox icon */}
                    <div className="relative z-10 mt-0.5 shrink-0">
                      <StepStatusIcon status={step.status} />
                    </div>

                    {/* Step content */}
                    <div className="min-w-0 flex-1 pb-3">
                      <div className="flex items-start gap-1.5">
                        <span className="text-[11px] font-semibold leading-tight text-[var(--text-primary)]">
                          {step.stepLabel}
                        </span>
                        {step.iteration > 1 && step.status !== "revision" && (
                          <span className="mt-px shrink-0 rounded bg-[var(--surface-alt)] px-1 py-0.5 text-[9px] font-medium text-[var(--text-soft)]">
                            iter {step.iteration}
                          </span>
                        )}
                      </div>

                      {step.agentName && (
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <div
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: agentColor }}
                          />
                          <span className="text-[9px] text-[var(--text-soft)]">
                            via {step.agentName}
                          </span>
                        </div>
                      )}

                      {step.status === "completed" && step.responseTime != null && (
                        <div className="mt-0.5 flex items-center gap-2 text-[9px] text-[var(--text-soft)]">
                          <span>{step.responseTime.toFixed(1)}s</span>
                          {step.tokens != null && step.tokens > 0 && (
                            <span>~{step.tokens} tok</span>
                          )}
                        </div>
                      )}

                      {step.feedbackMessage && (
                        <div
                          className={`mt-1 rounded-md px-2 py-1 text-[9px] leading-relaxed ${
                            step.status === "revision"
                              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              : "bg-green-500/10 text-green-600 dark:text-green-400"
                          }`}
                        >
                          {step.feedbackMessage}
                        </div>
                      )}

                      {step.error && (
                        <div className="mt-1 rounded-md bg-red-500/10 px-2 py-1 text-[9px] text-red-500">
                          {step.error}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Event Log */}
      <WorkflowEventLog steps={steps} />
    </div>
  );
}
