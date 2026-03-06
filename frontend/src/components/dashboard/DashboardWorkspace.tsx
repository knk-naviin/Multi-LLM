"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Layers,
  Users,
  Sparkles,
  ArrowRight,
  Clock,
  Loader2,
  BarChart3,
  Shield,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api";
import type { ChatSummary, TaskWorkflowSummary } from "@/lib/types";
import { getPreferredModel } from "@/lib/preferences";

interface StatsData {
  totalChats: number;
  totalWorkflows: number;
  favoriteModel: string;
  recentChats: ChatSummary[];
  recentWorkflows: TaskWorkflowSummary[];
}

const STAT_COLORS: Record<string, { bg: string; text: string }> = {
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-500" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-500" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-500" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  colorKey,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  colorKey: string;
}) {
  const colors = STAT_COLORS[colorKey] || STAT_COLORS.indigo;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 transition hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors.bg}`}>
          <Icon size={20} className={colors.text} />
        </div>
        <div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-left transition hover:border-[var(--brand)] hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-subtle)]">
        <Icon size={20} className="text-[var(--brand)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      </div>
      <ArrowRight
        size={16}
        className="shrink-0 text-[var(--text-soft)] transition group-hover:text-[var(--brand)] group-hover:translate-x-0.5"
      />
    </button>
  );
}

export function DashboardWorkspace() {
  const router = useRouter();
  const { isAuthenticated, user, token } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const preferredModel = getPreferredModel() || "Auto Router";

        let totalChats = 0;
        let recentChats: ChatSummary[] = [];
        let totalWorkflows = 0;
        let recentWorkflows: TaskWorkflowSummary[] = [];

        if (isAuthenticated && token) {
          try {
            const chatsRes = await apiRequest<{ ok: boolean; chats: ChatSummary[] }>(
              "/api/chats?limit=5",
              { token }
            );
            recentChats = chatsRes.chats || [];
            totalChats = recentChats.length;
          } catch {
            // Non-critical
          }

          try {
            const workflowsRes = await apiRequest<{ ok: boolean; workflows: TaskWorkflowSummary[] }>(
              "/api/task-workflows?limit=5",
              { token }
            );
            recentWorkflows = workflowsRes.workflows || [];
            totalWorkflows = recentWorkflows.length;
          } catch {
            // Non-critical
          }
        }

        setStats({
          totalChats,
          totalWorkflows,
          favoriteModel: preferredModel,
          recentChats,
          recentWorkflows,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [isAuthenticated, token]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {greeting()}{isAuthenticated && user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Welcome to Swastik AI — your multi-LLM workspace
          </p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[var(--text-soft)]" />
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                icon={MessageSquare}
                label="Recent Chats"
                value={stats?.totalChats ?? 0}
                colorKey="indigo"
              />
              <StatCard
                icon={Layers}
                label="Workflows"
                value={stats?.totalWorkflows ?? 0}
                colorKey="purple"
              />
              <StatCard
                icon={BarChart3}
                label="Favorite Model"
                value={stats?.favoriteModel || "—"}
                colorKey="emerald"
              />
              <StatCard
                icon={Shield}
                label="Account"
                value={isAuthenticated ? "Active" : "Guest"}
                colorKey="amber"
              />
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
              <h2 className="mb-4 text-sm font-semibold text-[var(--text-secondary)]">Quick Actions</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <QuickAction
                  icon={MessageSquare}
                  label="New Chat"
                  description="Start a conversation with any AI"
                  onClick={() => router.push("/chat")}
                />
                <QuickAction
                  icon={Layers}
                  label="Start Task"
                  description="Run a multi-agent workflow"
                  onClick={() => router.push("/task-mode")}
                />
                <QuickAction
                  icon={Users}
                  label="AI Council"
                  description="Multi-agent debate on a topic"
                  onClick={() => router.push("/council")}
                />
              </div>
            </div>

            {/* Recent Activity */}
            {isAuthenticated && (stats?.recentChats?.length ?? 0) > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">Recent Chats</h2>
                <div className="space-y-1">
                  {stats?.recentChats.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => router.push(`/chat/${chat.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--surface-alt)]"
                    >
                      <MessageSquare size={14} className="shrink-0 text-[var(--text-soft)]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">
                        {chat.title || "Untitled Chat"}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-[10px] text-[var(--text-soft)]">
                        <Clock size={10} />
                        {new Date(chat.updated_at || chat.created_at || Date.now()).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isAuthenticated && (stats?.recentWorkflows?.length ?? 0) > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">Recent Workflows</h2>
                <div className="space-y-1">
                  {stats?.recentWorkflows.map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      onClick={() => router.push("/task-mode")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--surface-alt)]"
                    >
                      <Layers size={14} className="shrink-0 text-[var(--text-soft)]" />
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">
                        {wf.task_prompt}
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-[10px] text-[var(--text-soft)]">
                        <Clock size={10} />
                        {new Date(wf.created_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
