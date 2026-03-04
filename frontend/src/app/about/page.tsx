"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap, Database, Code2, Cpu,
  Globe, ArrowRight, Activity, Layers,
  Lock, Sparkles, ChevronDown,
} from "lucide-react";

import { APP_NAME, AUTHOR_NAME, COMPANY_NAME, CLIENT_ROUTER_KEY } from "@/lib/constants";

const capabilities = [
  {
    title: "Intelligent Routing",
    description: "A benchmark model classifies each prompt and routes to the best LLM for optimal results.",
    icon: <Zap size={18} />,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    title: "Guest Access",
    description: "Instant access without authentication. Ephemeral sessions for quick tasks.",
    icon: <Globe size={18} />,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
  },
  {
    title: "Workspace Storage",
    description: "MongoDB-backed persistence for authenticated users with folder organization.",
    icon: <Database size={18} />,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    title: "Developer UI",
    description: "Markdown rendering with syntax-highlighted code blocks and model metadata.",
    icon: <Code2 size={18} />,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Multi-Model",
    description: "Cross-validate answers across GPT, Gemini, and Claude providers.",
    icon: <Layers size={18} />,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  {
    title: "Secure by Design",
    description: "JWT auth, encrypted sessions, and per-user data isolation.",
    icon: <Lock size={18} />,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
];

const models = [
  { name: "GPT-4o", provider: "OpenAI", color: "bg-emerald-500", domains: ["Code", "Logic", "Math"] },
  { name: "Gemini 2.0", provider: "Google", color: "bg-blue-500", domains: ["Research", "Multimodal", "Search"] },
  { name: "Claude 3.5", provider: "Anthropic", color: "bg-orange-500", domains: ["Writing", "Analysis", "Safety"] },
];

const pipeline = [
  { step: "01", label: "Prompt Intake", desc: "Tokenize and normalize input" },
  { step: "02", label: "Domain Classifier", desc: "Benchmark model scores intent" },
  { step: "03", label: "Provider Selection", desc: "Route to optimal LLM" },
  { step: "04", label: "Response Assembly", desc: "Generate, store, and annotate" },
];

const faqs = [
  {
    q: "How does model routing work?",
    a: "A benchmark model analyzes your prompt's domain, complexity, and intent, then scores each provider and routes to the best match.",
  },
  {
    q: "Is my data stored securely?",
    a: "Yes. Conversations are encrypted at rest. Each user's data is isolated in MongoDB with scoped access.",
  },
  {
    q: `Can I use ${APP_NAME} without signing up?`,
    a: "Guest sessions are fully ephemeral with no account required. Sign in to unlock persistence and cross-device sync.",
  },
];

function FaqItem({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)]"
      >
        {faq.q}
        <ChevronDown
          size={15}
          className={`shrink-0 text-[var(--text-soft)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
          {faq.a}
        </div>
      )}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      {/* Hero */}
      <section className="mb-12">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-white">
            <Cpu size={16} />
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
            Active
          </span>
        </div>

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          {APP_NAME}
        </h1>

        <p className="mb-6 max-w-xl text-base leading-relaxed text-[var(--text-muted)]">
          A multi-model AI platform by{" "}
          <strong className="text-[var(--text-primary)]">{AUTHOR_NAME}</strong> at{" "}
          <strong className="text-[var(--text-primary)]">{COMPANY_NAME}</strong>.
          Benchmark-driven routing across GPT, Gemini, and Claude.
        </p>

        <div className="flex gap-2">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-hover)]"
          >
            <Sparkles size={14} /> Start Chatting <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Models */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">
          <Activity size={12} />
          Model Providers
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {models.map((m) => (
            <div key={m.name} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${m.color}`} />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{m.name}</p>
                  <p className="text-[11px] text-[var(--text-soft)]">{m.provider}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {m.domains.map((d) => (
                  <span
                    key={d}
                    className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">
          <Zap size={12} />
          Capabilities
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((cap) => (
            <div key={cap.title} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${cap.bg} ${cap.color}`}>
                {cap.icon}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">{cap.title}</h3>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">{cap.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Routing Pipeline */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">
          <ArrowRight size={12} />
          Routing Pipeline
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="grid gap-0 sm:grid-cols-4">
            {pipeline.map((s, i) => (
              <div key={s.step} className="flex items-start gap-3 border-b border-[var(--border)] py-3 sm:flex-col sm:border-b-0 sm:border-r sm:px-3 sm:py-0 sm:last:border-r-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--brand-subtle)] text-[10px] font-bold text-[var(--brand-text)]">
                  {s.step}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{s.label}</p>
                  <p className="text-xs text-[var(--text-soft)]">{s.desc}</p>
                </div>
                {i < 3 && (
                  <ArrowRight size={12} className="mt-1 hidden shrink-0 text-[var(--text-soft)] sm:hidden" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Info */}
      <section className="mb-10">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              { label: "Lead Developer", value: AUTHOR_NAME },
              { label: "Organization", value: COMPANY_NAME },
              { label: "Storage", value: "MongoDB Atlas" },
              { label: "Auth", value: "JWT + Google OAuth" },
              { label: "Frontend", value: "Next.js + TypeScript" },
              { label: "Router Key", value: CLIENT_ROUTER_KEY },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-2 border-b border-[var(--border)] pb-2 last:border-b-0 sm:flex-col sm:border-b-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">{row.label}</span>
                <span className="text-sm text-[var(--text-primary)]">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">
          FAQ
        </div>
        <div className="grid gap-2">
          {faqs.map((faq) => (
            <FaqItem key={faq.q} faq={faq} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-lg bg-[var(--brand)] p-8 text-center">
        <h2 className="mb-2 text-xl font-bold text-white">
          Ready to try {APP_NAME}?
        </h2>
        <p className="mb-5 text-sm text-white/70">
          No signup required. Start chatting instantly.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[var(--brand)] transition hover:bg-white/90"
        >
          <Sparkles size={14} /> Get Started <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  );
}
