"use client";

import { useState } from "react";
import {
  ShieldCheck, Zap, Database, Code2, Cpu, Fingerprint,
  Globe, ArrowRight, CheckCircle2, Activity, Layers,
  GitBranch, Lock, Server, Sparkles, ChevronDown,
} from "lucide-react";

// ── Constants (replace with your imports) ─────────────────────────────────────
const APP_NAME        = "Nexus AI";
const AUTHOR_NAME     = "Alex Rivera";
const COMPANY_NAME    = "Studio Labs";
const CLIENT_ROUTER_KEY = "nxs-router-v1::prod-7f4a2c";

// ── Data ──────────────────────────────────────────────────────────────────────
interface Capability {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  tag: string;
}

const capabilities: Capability[] = [
  {
    title: "Intelligent Routing",
    description: "A dedicated benchmarkModel classifies each prompt domain and routes requests to GPT, Gemini, or Claude for optimal performance and accuracy.",
    icon: <Zap size={20} />,
    accent: "#f59e0b",
    tag: "Core",
  },
  {
    title: "On-Demand Guest Access",
    description: "Instant conversational access without authentication. Ephemeral sessions for quick tasks and immediate results — no friction.",
    icon: <Globe size={20} />,
    accent: "#0ea5e9",
    tag: "Access",
  },
  {
    title: "Enterprise Workspace",
    description: "Full project management and MongoDB-backed persistence for authenticated users, ensuring your context and history are never lost.",
    icon: <Database size={20} />,
    accent: "#7c3aed",
    tag: "Storage",
  },
  {
    title: "Developer-First UI",
    description: "High-fidelity Markdown rendering with syntax-highlighted code blocks, custom typewriter animations, and transparent model metadata.",
    icon: <Code2 size={20} />,
    accent: "#10b981",
    tag: "UX",
  },
  {
    title: "Multi-Model Consensus",
    description: "Cross-validate answers across providers. When precision matters, Nexus queries multiple models and surfaces conflicting perspectives.",
    icon: <Layers size={20} />,
    accent: "#f43f5e",
    tag: "Advanced",
  },
  {
    title: "Zero-Trust Security",
    description: "End-to-end encrypted sessions, scoped API keys, and per-user data isolation. Built with security-first architecture from day one.",
    icon: <Lock size={20} />,
    accent: "#8b5cf6",
    tag: "Security",
  },
];

const models = [
  { name: "GPT-4o",        provider: "OpenAI",    color: "#10a37f", domains: ["Code", "Logic", "Math"] },
  { name: "Gemini 1.5 Pro", provider: "Google",   color: "#4285f4", domains: ["Research", "Multimodal", "Search"] },
  { name: "Claude 3.5",    provider: "Anthropic", color: "#cc785c", domains: ["Writing", "Analysis", "Safety"] },
];

const stats = [
  { label: "Avg Response",    value: "1.4s",  sub: "median latency" },
  { label: "Model Accuracy",  value: "94.2%", sub: "benchmark suite" },
  { label: "Uptime",          value: "99.9%", sub: "last 90 days" },
  { label: "Projects Served", value: "12k+",  sub: "active workspaces" },
];

const techStack = [
  { name: "Next.js 14",    icon: "▲", color: "#111827" },
  { name: "TypeScript",    icon: "TS", color: "#3178c6" },
  { name: "MongoDB Atlas", icon: "🍃", color: "#10b981" },
  { name: "Tailwind CSS",  icon: "✦", color: "#0ea5e9" },
  { name: "Vercel Edge",   icon: "⚡", color: "#f59e0b" },
  { name: "OpenAI SDK",    icon: "○", color: "#10a37f" },
];

// ── FAQ data ──────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: "How does model routing work?",
    a: "A lightweight benchmarkModel analyzes your prompt's domain, complexity, and intent. It scores each provider against historical performance data for that category and routes to the best match — all in under 50ms.",
  },
  {
    q: "Is my data stored securely?",
    a: "Yes. All conversations are encrypted at rest using AES-256 and in transit via TLS 1.3. Each user's data is namespace-isolated in MongoDB Atlas with per-document ACLs.",
  },
  {
    q: "Can I use Nexus AI without signing up?",
    a: "Absolutely. Guest sessions are fully ephemeral — no account required. Sessions auto-expire after inactivity. Sign in to unlock project persistence and cross-device sync.",
  },
];

// ── Components ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{
      padding: "20px 24px", borderRadius: 16,
      background: "#fff", border: "1px solid #e5e7eb",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <span style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: -1, fontFamily: "'Instrument Serif', serif" }}>
        {value}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>{label}</span>
      <span style={{ fontSize: 11, color: "#9ca3af" }}>{sub}</span>
    </div>
  );
}

function CapabilityCard({ cap }: { cap: Capability }) {
  const [hovered, setHovered] = useState(false);
  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "24px", borderRadius: 18,
        background: "#fff",
        border: `1.5px solid ${hovered ? cap.accent + "55" : "#e5e7eb"}`,
        boxShadow: hovered ? `0 8px 32px ${cap.accent}18` : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "all 0.22s ease",
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: cap.accent + "14",
          border: `1px solid ${cap.accent}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: cap.accent, transition: "all 0.22s",
          transform: hovered ? "scale(1.08)" : "scale(1)",
        }}>
          {cap.icon}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
          textTransform: "uppercase", padding: "3px 9px", borderRadius: 100,
          background: cap.accent + "12", color: cap.accent,
          border: `1px solid ${cap.accent}25`,
        }}>
          {cap.tag}
        </span>
      </div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 8, letterSpacing: -0.2 }}>
        {cap.title}
      </h2>
      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "#6b7280" }}>
        {cap.description}
      </p>
    </article>
  );
}

function ModelCard({ model }: { model: typeof models[0] }) {
  return (
    <div style={{
      padding: "20px 22px", borderRadius: 16,
      background: "#fff", border: "1px solid #e5e7eb",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: model.color + "15", border: `1px solid ${model.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: model.color }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{model.name}</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>{model.provider}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#10b981", fontWeight: 600 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981", animation: "apPulse 2s ease infinite" }} />
          Active
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {model.domains.map(d => (
          <span key={d} style={{
            fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 100,
            background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb",
          }}>{d}</span>
        ))}
      </div>
    </div>
  );
}

function FaqItem({ faq }: { faq: typeof faqs[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderRadius: 14, border: "1px solid #e5e7eb",
      background: "#fff", overflow: "hidden",
      transition: "box-shadow 0.15s",
      boxShadow: open ? "0 4px 16px rgba(0,0,0,0.06)" : "0 1px 4px rgba(0,0,0,0.03)",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: "transparent", border: "none", cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 14.5, fontWeight: 600, color: "#111827" }}>{faq.q}</span>
        <ChevronDown size={16} style={{
          color: "#9ca3af", flexShrink: 0,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
        }} />
      </button>
      {open && (
        <div style={{ padding: "0 20px 16px", fontSize: 13.5, lineHeight: 1.7, color: "#6b7280", animation: "apFadeIn 0.2s ease" }}>
          {faq.a}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AboutPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f5f5f7; font-family: 'DM Sans', sans-serif; color: #1f2937; }

        .ap-page {
          max-width: 1024px; margin: 0 auto;
          padding: 32px 16px 80px;
          display: flex; flex-direction: column; gap: 20px;
          animation: apSlideUp 0.5s ease both;
        }
        @media (min-width: 640px) { .ap-page { padding: 32px 24px 80px; } }

        @keyframes apSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes apFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes apPulse {
          0%,100% { opacity: 1; } 50% { opacity: 0.4; }
        }

        .ap-hero {
          position: relative; overflow: hidden;
          border-radius: 24px;
          background: #fff;
          border: 1px solid #e5e7eb;
          padding: 40px 36px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        }
        @media (min-width: 640px) { .ap-hero { padding: 48px 48px; } }

        .ap-hero-mesh {
          position: absolute; top: -60px; right: -60px;
          width: 320px; height: 320px; border-radius: 50%;
          background: radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .ap-hero-mesh-2 {
          position: absolute; bottom: -80px; left: 20%;
          width: 240px; height: 240px; border-radius: 50%;
          background: radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .ap-section-title {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          text-transform: uppercase; color: #9ca3af;
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 16px;
        }
        .ap-section-title::after {
          content: ""; flex: 1; height: 1px; background: #e5e7eb;
        }

        .ap-grid-2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 600px) { .ap-grid-2 { grid-template-columns: 1fr 1fr; } }

        .ap-grid-3 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (min-width: 640px) { .ap-grid-3 { grid-template-columns: repeat(4, 1fr); } }

        .ap-grid-models { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 640px) { .ap-grid-models { grid-template-columns: repeat(3, 1fr); } }

        .ap-grid-caps { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 600px) { .ap-grid-caps { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 900px) { .ap-grid-caps { grid-template-columns: 1fr 1fr 1fr; } }

        .ap-card {
          background: #fff; border-radius: 20px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          padding: 28px;
        }

        .ap-tag {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 12px; border-radius: 100px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        .ap-spec-row {
          display: flex; flex-direction: column; gap: 3px;
          padding: 14px 0; border-bottom: 1px solid #f3f4f6;
        }
        .ap-spec-row:last-child { border-bottom: none; }
        .ap-spec-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #7c3aed; }
        .ap-spec-value { font-size: 14px; font-weight: 600; color: #111827; display: flex; align-items: center; gap: 6px; }

        .ap-tech-chip {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 14px; border-radius: 10px;
          background: #f9fafb; border: 1px solid #e5e7eb;
          font-size: 12.5px; font-weight: 600; color: #374151;
          transition: all 0.14s;
        }
        .ap-tech-chip:hover { background: #fff; border-color: #d1d5db; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

        .ap-cta {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 22px; border-radius: 12px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700;
          cursor: pointer; border: none; transition: all 0.15s;
          text-decoration: none;
        }
        .ap-cta-primary {
          background: #7c3aed; color: #fff;
          box-shadow: 0 4px 14px rgba(124,58,237,0.3);
        }
        .ap-cta-primary:hover { background: #6d28d9; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(124,58,237,0.38); }
        .ap-cta-secondary {
          background: #fff; color: #374151;
          border: 1.5px solid #e5e7eb !important;
        }
        .ap-cta-secondary:hover { background: #f9fafb; border-color: #d1d5db !important; }
      `}</style>

      <div className="ap-page">

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="ap-hero">
          <div className="ap-hero-mesh" />
          <div className="ap-hero-mesh-2" />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 640 }}>
            {/* Eyebrow */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
              }}>
                <Cpu size={22} color="#fff" />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="ap-tag" style={{ background: "#ede9fe", color: "#7c3aed", border: "1px solid #ddd6fe" }}>
                  v1.0.4 Stable
                </span>
                <span className="ap-tag" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 5px #10b981", animation: "apPulse 2s ease infinite" }} />
                  Systems Active
                </span>
              </div>
            </div>

            <h1 style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: "clamp(36px, 5vw, 52px)",
              fontWeight: 400, color: "#111827",
              letterSpacing: -1, lineHeight: 1.1, marginBottom: 16,
            }}>
              Meet <em style={{ fontStyle: "italic", color: "#7c3aed" }}>{APP_NAME}</em>
            </h1>

            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#6b7280", marginBottom: 28, maxWidth: 520 }}>
              A state-of-the-art multi-model ecosystem developed by{" "}
              <strong style={{ color: "#111827" }}>{AUTHOR_NAME}</strong> at{" "}
              <strong style={{ color: "#111827" }}>{COMPANY_NAME}</strong>.
              We bridge the gap between LLM providers with a unified, benchmark-driven interface.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/chat" className="ap-cta ap-cta-primary">
                <Sparkles size={15} /> Start for Free <ArrowRight size={14} />
              </a>
              <a href="#architecture" className="ap-cta ap-cta-secondary" style={{ border: "1.5px solid #e5e7eb" }}>
                <GitBranch size={15} /> Architecture
              </a>
            </div>
          </div>
        </section>

        {/* ── STATS ─────────────────────────────────────────────────────────── */}
        <div className="ap-grid-3" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
          {stats.map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* ── MODELS ────────────────────────────────────────────────────────── */}
        <div>
          <div className="ap-section-title">
            <Activity size={13} /> Model Providers
          </div>
          <div className="ap-grid-models">
            {models.map(m => <ModelCard key={m.name} model={m} />)}
          </div>
        </div>

        {/* ── CAPABILITIES ──────────────────────────────────────────────────── */}
        <div>
          <div className="ap-section-title">
            <Zap size={13} /> Core Capabilities
          </div>
          <div className="ap-grid-caps">
            {capabilities.map(cap => <CapabilityCard key={cap.title} cap={cap} />)}
          </div>
        </div>

        {/* ── ARCHITECTURE + SPECS ─────────────────────────────────────────── */}
        <div id="architecture" className="ap-grid-2">
          {/* Left: System specs */}
          <div className="ap-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Fingerprint size={18} style={{ color: "#7c3aed" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", letterSpacing: 0.2 }}>
                System Identity
              </span>
            </div>
            <div>
              {[
                { label: "Lead Architect",      value: AUTHOR_NAME },
                { label: "Organization",         value: COMPANY_NAME },
                { label: "Storage Engine",       value: "MongoDB Atlas", icon: <ShieldCheck size={14} style={{ color: "#10b981" }} /> },
                { label: "Runtime",              value: "Vercel Edge Network" },
                { label: "Auth Provider",        value: "JWT + Secure Cookies" },
              ].map(row => (
                <div className="ap-spec-row" key={row.label}>
                  <span className="ap-spec-label">{row.label}</span>
                  <span className="ap-spec-value">
                    {row.icon}{row.value}
                  </span>
                </div>
              ))}
              <div className="ap-spec-row">
                <span className="ap-spec-label">Deployment Key</span>
                <code style={{
                  fontSize: 12, fontFamily: "monospace", padding: "6px 10px",
                  background: "#f5f3ff", borderRadius: 8,
                  border: "1px solid #e9d5ff", color: "#7c3aed",
                  letterSpacing: 0.3, wordBreak: "break-all",
                }}>
                  {CLIENT_ROUTER_KEY}
                </code>
              </div>
            </div>
          </div>

          {/* Right: Routing flow */}
          <div className="ap-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <GitBranch size={18} style={{ color: "#7c3aed" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                Routing Pipeline
              </span>
            </div>
            {[
              { step: "01", label: "Prompt Intake",     desc: "Tokenize and normalize input", color: "#7c3aed" },
              { step: "02", label: "Domain Classifier",  desc: "benchmarkModel scores intent", color: "#0ea5e9" },
              { step: "03", label: "Provider Selection", desc: "Route to optimal LLM",         color: "#f59e0b" },
              { step: "04", label: "Response Assembly",  desc: "Stream, store, and annotate",  color: "#10b981" },
            ].map((s, i) => (
              <div key={s.step} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "10px 0",
                borderBottom: i < 3 ? "1px dashed #f3f4f6" : "none",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: s.color + "14", border: `1px solid ${s.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, color: s.color, letterSpacing: 0.5,
                }}>
                  {s.step}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{s.desc}</div>
                </div>
                {i < 3 && (
                  <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                    <ArrowRight size={13} style={{ color: "#d1d5db", marginTop: 6 }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── TECH STACK ────────────────────────────────────────────────────── */}
        <div className="ap-card" style={{ padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Server size={16} style={{ color: "#7c3aed" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Technology Stack</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {techStack.map(t => (
              <div key={t.name} className="ap-tech-chip">
                <span style={{ fontSize: 13, color: t.color }}>{t.icon}</span>
                <span>{t.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <div>
          <div className="ap-section-title">
            <CheckCircle2 size={13} /> Frequently Asked
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {faqs.map(faq => <FaqItem key={faq.q} faq={faq} />)}
          </div>
        </div>

        {/* ── FOOTER CTA ────────────────────────────────────────────────────── */}
        <section style={{
          borderRadius: 24, overflow: "hidden",
          background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)",
          padding: "44px 36px", textAlign: "center", position: "relative",
          boxShadow: "0 8px 40px rgba(124,58,237,0.3)",
        }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -60, left: 10, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(24px, 4vw, 34px)", color: "#fff", marginBottom: 10, fontWeight: 400 }}>
              Ready to explore {APP_NAME}?
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginBottom: 28, maxWidth: 400, margin: "0 auto 28px" }}>
              No credit card. No setup. Start chatting instantly with the world&apos;s best LLMs.
            </p>
            <a href="/chat" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "13px 28px", borderRadius: 12,
              background: "#fff", color: "#7c3aed",
              fontSize: 14, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)"; }}
            >
              <Sparkles size={15} /> Get Started Free <ArrowRight size={15} />
            </a>
          </div>
        </section>

        {/* ── FOOTNOTE ──────────────────────────────────────────────────────── */}
        <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", fontStyle: "italic", paddingBottom: 8 }}>
          Built with Next.js, TypeScript, and Tailwind CSS for the modern web.
          © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
        </p>

      </div>
    </>
  );
}
