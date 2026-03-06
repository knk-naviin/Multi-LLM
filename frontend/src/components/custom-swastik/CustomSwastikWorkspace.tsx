"use client";

import { Sparkles, Workflow, Bot, Zap, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Custom AI Agents",
    description: "Define specialized agents with custom instructions, personas, and capabilities.",
  },
  {
    icon: Workflow,
    title: "Visual Workflows",
    description: "Build multi-step AI pipelines by connecting agents in a visual graph editor.",
  },
  {
    icon: Zap,
    title: "Natural Language Config",
    description: "Describe what you want in plain English — Swastik builds the workflow for you.",
  },
];

export function CustomSwastikWorkspace() {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-subtle)]">
            <Sparkles size={32} className="text-[var(--brand)]" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Custom Swastik</h1>
          <p className="mt-3 text-base text-[var(--text-muted)] max-w-md mx-auto">
            Create your own AI agent workflows with natural language. Design, connect, and deploy
            custom AI pipelines tailored to your needs.
          </p>
        </div>

        {/* Features */}
        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-subtle)]">
                  <Icon size={20} className="text-[var(--brand)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{feature.title}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Coming Soon */}
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-alt)]">
            <Sparkles size={20} className="text-[var(--text-soft)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Coming Soon</h3>
          <p className="mt-2 text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Custom Swastik is currently under development. Soon you&apos;ll be able to create
            custom AI workflows using natural language, connect multiple agents, and automate complex
            tasks with a visual graph editor.
          </p>
          <button
            type="button"
            disabled
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white opacity-50 cursor-not-allowed"
          >
            Get Started
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
