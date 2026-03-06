"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Cpu, Pause, Play, SkipBack, SkipForward, Trophy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { BRAND_GRADIENT } from "@/lib/brand";
import type { AgentConversationMessage, TimelineStep } from "@/lib/types";

/* ── Agent Colors ── */

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gpt: { bg: "rgba(16,163,127,0.10)", text: "#10a37f", border: "rgba(16,163,127,0.25)" },
  gemini: { bg: "rgba(66,133,244,0.10)", text: "#4285f4", border: "rgba(66,133,244,0.25)" },
  claude: { bg: "rgba(217,119,6,0.10)", text: "#d97706", border: "rgba(217,119,6,0.25)" },
  grok: { bg: "rgba(239,68,68,0.10)", text: "#ef4444", border: "rgba(239,68,68,0.25)" },
};

const AGENT_DOT_COLORS: Record<string, string> = {
  gpt: "#10a37f",
  gemini: "#4285f4",
  claude: "#d97706",
  grok: "#ef4444",
};

/* ── Replay Timeline Strip ── */

function ReplayTimeline({
  steps,
  currentIndex,
  onJump,
}: {
  steps: TimelineStep[];
  currentIndex: number;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {steps.map((step, idx) => {
        const dotColor = AGENT_DOT_COLORS[step.agent] || "#6b7280";
        const isActive = idx === currentIndex;
        const isPast = idx < currentIndex;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onJump(idx)}
            className={`shrink-0 rounded-full transition-all duration-200 ${
              isActive
                ? "h-3.5 w-3.5 ring-2 ring-white/50"
                : isPast
                ? "h-2.5 w-2.5 opacity-80"
                : "h-2 w-2 opacity-40"
            }`}
            style={{ background: dotColor }}
            title={step.stepLabel}
          />
        );
      })}
    </div>
  );
}

/* ── Replay Controls ── */

function ReplayControls({
  currentIndex,
  totalSteps,
  isPlaying,
  playbackSpeed,
  onPrevious,
  onNext,
  onTogglePlay,
  onSpeedChange,
  onSliderChange,
}: {
  currentIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  playbackSpeed: 1 | 2 | 4;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: 1 | 2 | 4) => void;
  onSliderChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      {/* Slider */}
      <input
        type="range"
        min={0}
        max={Math.max(totalSteps - 1, 0)}
        value={currentIndex}
        onChange={(e) => onSliderChange(Number(e.target.value))}
        className="w-full accent-[var(--brand)] h-1.5"
      />

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Step counter */}
        <span className="text-[11px] font-medium text-[var(--text-muted)] min-w-[80px]">
          Step {currentIndex + 1} of {totalSteps}
        </span>

        {/* Playback buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={currentIndex <= 0}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipBack size={12} />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition"
            style={{ background: BRAND_GRADIENT }}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={currentIndex >= totalSteps - 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipForward size={12} />
          </button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1 min-w-[80px] justify-end">
          {([1, 2, 4] as const).map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => onSpeedChange(speed)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                playbackSpeed === speed
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text-soft)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Step Content Viewer ── */

function StepContentView({
  step,
  message,
}: {
  step: TimelineStep;
  message?: AgentConversationMessage;
}) {
  const colors = AGENT_COLORS[step.agent] || { bg: "#6b728014", text: "#6b7280", border: "#6b728040" };
  const content = message?.content || step.content || "";

  if (step.step === "final_synthesis") {
    return (
      <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-white"
            style={{ background: BRAND_GRADIENT }}
          >
            <Trophy size={12} />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Final Synthesized Result
          </span>
        </div>
        <div className="prose prose-sm max-w-none break-words text-[var(--text-primary)] prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  if (step.feedbackMessage && !content) {
    return (
      <div
        className={`rounded-xl border p-4 ${
          step.status === "revision"
            ? "border-yellow-500/30 bg-yellow-500/5"
            : "border-green-500/30 bg-green-500/5"
        }`}
      >
        <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">
          {step.stepLabel}
        </p>
        <p className={`text-sm ${step.status === "revision" ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
          {step.feedbackMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: colors.border, background: colors.bg + "33" }}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          {(step.agentName || step.agent).slice(0, 2).toUpperCase()}
        </div>
        <div>
          <span className="text-sm font-semibold" style={{ color: colors.text }}>
            {step.agentName || step.agent}
          </span>
          <span className="ml-2 rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
            {step.stepLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      {content ? (
        <div className="prose prose-sm max-w-none break-words text-[var(--text-secondary)] prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-[var(--text-soft)] italic">No content for this step.</p>
      )}

      {/* Footer */}
      {(step.responseTime != null || (step.tokens != null && step.tokens > 0)) && (
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-soft)]">
          {step.responseTime != null && (
            <span className="flex items-center gap-1">
              <Clock size={9} />
              {step.responseTime.toFixed(1)}s
            </span>
          )}
          {step.tokens != null && step.tokens > 0 && (
            <span className="flex items-center gap-1">
              <Cpu size={9} />
              ~{step.tokens} tokens
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Replay Player ── */

interface TaskReplayPlayerProps {
  agentMessages: AgentConversationMessage[];
  timelineSteps: TimelineStep[];
  finalResult: {
    content: string;
    agent?: string;
    agentName?: string;
    responseTime?: number;
    tokens?: number;
  } | null;
  totalTime?: number;
  totalTokens?: number;
}

export function TaskReplayPlayer({
  agentMessages,
  timelineSteps,
  finalResult,
  totalTime,
  totalTokens,
}: TaskReplayPlayerProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const totalSteps = timelineSteps.length;

  // Create a mapping from step index to agent message
  const stepMessageMap = useMemo(() => {
    const map = new Map<number, AgentConversationMessage>();
    let msgIdx = 0;
    for (let i = 0; i < timelineSteps.length; i++) {
      const step = timelineSteps[i];
      // Only match steps that have content and correspond to agent messages
      if (
        step.status === "completed" &&
        step.content &&
        step.step !== "review_feedback" &&
        step.step !== "review_approved" &&
        step.step !== "qc_feedback" &&
        step.step !== "qc_passed" &&
        msgIdx < agentMessages.length
      ) {
        map.set(i, agentMessages[msgIdx]);
        msgIdx++;
      }
    }
    return map;
  }, [timelineSteps, agentMessages]);

  // Visible data based on current index
  const visibleSteps = timelineSteps.slice(0, currentStepIndex + 1);
  const currentStep = timelineSteps[currentStepIndex];
  const currentMessage = stepMessageMap.get(currentStepIndex);

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (currentStepIndex >= totalSteps - 1) {
      setIsPlaying(false);
      return;
    }

    // Calculate delay based on the current step's response time
    const baseDelay = currentStep?.responseTime
      ? Math.min(currentStep.responseTime * 1000, 5000)
      : 2000;
    const delay = baseDelay / playbackSpeed;

    intervalRef.current = setTimeout(() => {
      setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
    }, delay);

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [isPlaying, currentStepIndex, totalSteps, playbackSpeed, currentStep]);

  // Scroll content into view on step change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStepIndex]);

  const handlePrevious = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const handleTogglePlay = useCallback(() => {
    if (currentStepIndex >= totalSteps - 1) {
      // Restart from beginning
      setCurrentStepIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [currentStepIndex, totalSteps]);

  const handleSliderChange = useCallback((value: number) => {
    setCurrentStepIndex(value);
    setIsPlaying(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "j") {
        handlePrevious();
      } else if (e.key === "ArrowRight" || e.key === "l") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleTogglePlay, handlePrevious, handleNext]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Top: Replay timeline strip */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
        <div className="mx-auto max-w-4xl">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Workflow Replay
            </span>
            {totalTime != null && (
              <span className="text-[10px] text-[var(--text-soft)]">
                Total: {totalTime.toFixed(1)}s{totalTokens != null && totalTokens > 0 ? ` · ~${totalTokens} tokens` : ""}
              </span>
            )}
          </div>
          <ReplayTimeline
            steps={timelineSteps}
            currentIndex={currentStepIndex}
            onJump={(idx) => {
              setCurrentStepIndex(idx);
              setIsPlaying(false);
            }}
          />
        </div>
      </div>

      {/* Middle: Step content */}
      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          {currentStep && (
            <StepContentView step={currentStep} message={currentMessage} />
          )}

          {/* Show final result on last step if it's the synthesis */}
          {currentStepIndex === totalSteps - 1 &&
            finalResult &&
            currentStep?.step !== "final_synthesis" && (
              <div className="mt-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                    style={{ background: BRAND_GRADIENT }}
                  >
                    <Trophy size={12} />
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    Final Optimized Result
                  </span>
                </div>
                <div className="prose prose-sm max-w-none break-words text-[var(--text-primary)] prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-a:text-inherit">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {finalResult.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Bottom: Replay controls */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <ReplayControls
            currentIndex={currentStepIndex}
            totalSteps={totalSteps}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onTogglePlay={handleTogglePlay}
            onSpeedChange={setPlaybackSpeed}
            onSliderChange={handleSliderChange}
          />
        </div>
      </div>
    </div>
  );
}
