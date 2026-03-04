"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  LogOut,
  Save,
  Shield,
  Trash2,
} from "lucide-react";

import { useAlerts } from "@/contexts/AlertContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { apiRequest } from "@/lib/api";
import { setAutoStore, setPreferredModel } from "@/lib/preferences";
import type { AppSettings, AuthSession, ModelName, ThemeName, UiDensity, UiLanguage } from "@/lib/types";

interface SettingsResponse {
  ok: boolean;
  settings: AppSettings;
}

const defaultSettings: AppSettings = {
  preferred_model: null,
  theme: "dark",
  auto_store_chats: true,
  language: "en",
  density: "comfortable",
  notifications: {
    email_digest: true,
    browser_push: false,
    product_updates: true,
    weekly_recap: false,
  },
  privacy: {
    share_analytics: true,
    improve_model: false,
  },
  security: {
    two_factor_enabled: false,
  },
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-[var(--brand)]" : "bg-[var(--surface-hover)]"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-b-0">
      <div>
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-soft)]">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function toReadableDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function SettingsPanel() {
  const { showAlert } = useAlerts();
  const { token, user, loading: authLoading, signOut } = useAuth();
  const { setTheme } = useTheme();

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const currentSession = useMemo(() => sessions.find((session) => session.current) || null, [sessions]);

  useEffect(() => {
    if (!token) {
      setLoadingSettings(false);
      return;
    }

    const load = async () => {
      setLoadingSettings(true);
      const [settingsRes, sessionsRes] = await Promise.all([
        apiRequest<SettingsResponse>("/api/settings", { token }),
        apiRequest<{ ok: boolean; sessions: AuthSession[] }>("/api/auth/sessions", { token }),
      ]);

      setSettings(settingsRes.settings);
      setSessions(sessionsRes.sessions || []);

      setTheme(settingsRes.settings.theme);
      setPreferredModel(settingsRes.settings.preferred_model);
      setAutoStore(settingsRes.settings.auto_store_chats);
    };

    load()
      .catch((error) => {
        showAlert(error instanceof Error ? error.message : "Failed to load settings");
      })
      .finally(() => {
        setLoadingSettings(false);
      });
  }, [setTheme, showAlert, token]);

  const patchSettings = (updater: (current: AppSettings) => AppSettings) => {
    setSettings((current) => updater(current));
  };

  const saveSettings = async () => {
    if (!token) {
      showAlert("Sign in required.");
      return;
    }

    setSaving(true);
    try {
      const response = await apiRequest<SettingsResponse>("/api/settings", {
        method: "PUT",
        token,
        body: settings,
      });

      setSettings(response.settings);
      setTheme(response.settings.theme);
      setPreferredModel(response.settings.preferred_model);
      setAutoStore(response.settings.auto_store_chats);

      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      showAlert("Settings saved.", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const refreshSessions = async () => {
    if (!token) return;
    const sessionRes = await apiRequest<{ ok: boolean; sessions: AuthSession[] }>("/api/auth/sessions", { token });
    setSessions(sessionRes.sessions || []);
  };

  const revokeSession = async (sessionId: string) => {
    if (!token) return;
    setBusyAction(`revoke-${sessionId}`);
    try {
      await apiRequest<{ ok: boolean }>(`/api/auth/sessions/${sessionId}`, { method: "DELETE", token });
      await refreshSessions();
      showAlert("Session revoked.", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to revoke session");
    } finally {
      setBusyAction(null);
    }
  };

  const logoutAll = async () => {
    if (!token) return;
    setBusyAction("logout-all");
    try {
      await apiRequest<{ ok: boolean; revoked_sessions: number }>("/api/auth/logout-all", { method: "POST", token });
      await refreshSessions();
      showAlert("Logged out from other devices.", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to logout other sessions");
    } finally {
      setBusyAction(null);
    }
  };

  const clearChats = async () => {
    if (!token) return;
    setBusyAction("clear-chats");
    try {
      await apiRequest<{ ok: boolean; deleted_chats: number }>("/api/chats", { method: "DELETE", token });
      showAlert("All chats cleared.", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to clear chats");
    } finally {
      setBusyAction(null);
    }
  };

  const exportChats = async () => {
    if (!token) return;
    setBusyAction("export");
    try {
      const payload = await apiRequest<{ ok: boolean; exported_at: string; chats: unknown[] }>(
        "/api/chats/export",
        { token }
      );
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `swastik-chat-export-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(href);
      showAlert("Chat export downloaded.", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to export chats");
    } finally {
      setBusyAction(null);
    }
  };

  const deleteAccount = async () => {
    if (!token) return;
    const confirmed = window.confirm("This will permanently delete your account and all data. Continue?");
    if (!confirmed) return;
    setBusyAction("delete-account");
    try {
      await apiRequest<{ ok: boolean }>("/api/account", { method: "DELETE", token });
      await signOut();
      showAlert("Account deleted.", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to delete account");
    } finally {
      setBusyAction(null);
    }
  };

  if (authLoading || loadingSettings) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
          <Loader2 size={16} className="animate-spin" />
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 w-full max-w-3xl px-4 pb-16">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/chat"
            className="mb-2 inline-flex items-center gap-1 text-xs text-[var(--text-soft)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft size={14} />
            Back to Chat
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        </div>

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-alt)] disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Save size={14} />}
          {saving ? "Saving" : saved ? "Saved" : "Save"}
        </button>
      </div>

      <div className="grid gap-4">
        {/* Appearance */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Appearance</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs text-[var(--text-soft)]">
              Theme
              <select
                value={settings.theme}
                onChange={(e) => {
                  const next = e.target.value as ThemeName;
                  patchSettings((c) => ({ ...c, theme: next }));
                  setTheme(next);
                }}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--text-soft)]">
              Language
              <select
                value={settings.language}
                onChange={(e) => patchSettings((c) => ({ ...c, language: e.target.value as UiLanguage }))}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
              >
                <option value="en">English</option>
                <option value="es">Espa&ntilde;ol</option>
                <option value="fr">Fran&ccedil;ais</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
                <option value="hi">Hindi</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-[var(--text-soft)]">
              Density
              <select
                value={settings.density}
                onChange={(e) => patchSettings((c) => ({ ...c, density: e.target.value as UiDensity }))}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
                <option value="spacious">Spacious</option>
              </select>
            </label>
          </div>
        </section>

        {/* Model & Data */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Model & Data</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-[var(--text-soft)]">
              Preferred Model
              <select
                value={settings.preferred_model || "auto"}
                onChange={(e) => {
                  const raw = e.target.value;
                  const next = raw === "auto" ? null : (raw as Exclude<ModelName, null>);
                  patchSettings((c) => ({ ...c, preferred_model: next }));
                }}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
              >
                <option value="auto">Auto Router</option>
                <option value="gpt">GPT</option>
                <option value="gemini">Gemini</option>
                <option value="claude">Claude</option>
              </select>
            </label>
            <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
              <ToggleRow
                label="Auto Store Chats"
                description="Persist chats to your workspace"
                checked={settings.auto_store_chats}
                onChange={(next) => patchSettings((c) => ({ ...c, auto_store_chats: next }))}
              />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Notifications</h2>
          <ToggleRow
            label="Email Digest"
            description="Receive periodic summary emails"
            checked={settings.notifications.email_digest}
            onChange={(next) => patchSettings((c) => ({ ...c, notifications: { ...c.notifications, email_digest: next } }))}
          />
          <ToggleRow
            label="Browser Push"
            description="Enable browser push notifications"
            checked={settings.notifications.browser_push}
            onChange={(next) => patchSettings((c) => ({ ...c, notifications: { ...c.notifications, browser_push: next } }))}
          />
          <ToggleRow
            label="Product Updates"
            description="Get feature release announcements"
            checked={settings.notifications.product_updates}
            onChange={(next) => patchSettings((c) => ({ ...c, notifications: { ...c.notifications, product_updates: next } }))}
          />
          <ToggleRow
            label="Weekly Recap"
            description="Receive weekly workspace report"
            checked={settings.notifications.weekly_recap}
            onChange={(next) => patchSettings((c) => ({ ...c, notifications: { ...c.notifications, weekly_recap: next } }))}
          />
        </section>

        {/* Privacy & Security */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Privacy & Security</h2>
          <ToggleRow
            label="Share Analytics"
            description="Share anonymous usage metrics"
            checked={settings.privacy.share_analytics}
            onChange={(next) => patchSettings((c) => ({ ...c, privacy: { ...c.privacy, share_analytics: next } }))}
          />
          <ToggleRow
            label="Improve Model"
            description="Allow anonymized prompt quality feedback"
            checked={settings.privacy.improve_model}
            onChange={(next) => patchSettings((c) => ({ ...c, privacy: { ...c.privacy, improve_model: next } }))}
          />
          <ToggleRow
            label="Two-Factor Auth"
            description="Extra account login protection"
            checked={settings.security.two_factor_enabled}
            onChange={(next) => patchSettings((c) => ({ ...c, security: { ...c.security, two_factor_enabled: next } }))}
          />

          {/* Sessions */}
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-soft)]">Active Sessions</span>
              <button
                type="button"
                onClick={logoutAll}
                disabled={busyAction === "logout-all"}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] disabled:opacity-60"
              >
                {busyAction === "logout-all" ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                Logout Others
              </button>
            </div>

            <div className="grid gap-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                >
                  <div className="text-xs text-[var(--text-soft)]">
                    <p className="font-medium text-[var(--text-primary)]">{session.current ? "Current Session" : "Active Session"}</p>
                    <p>Started: {toReadableDate(session.created_at)}</p>
                    <p>Expires: {toReadableDate(session.expires_at)}</p>
                  </div>
                  {!session.current ? (
                    <button
                      type="button"
                      onClick={() => revokeSession(session.id)}
                      disabled={busyAction === `revoke-${session.id}`}
                      className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/5 disabled:opacity-60"
                    >
                      {busyAction === `revoke-${session.id}` ? "Revoking" : "Revoke"}
                    </button>
                  ) : (
                    <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                      Current
                    </span>
                  )}
                </div>
              ))}
              {!sessions.length && <p className="text-xs text-[var(--text-soft)]">No session data.</p>}
            </div>

            {currentSession && (
              <p className="mt-2 text-[11px] text-[var(--text-soft)]">
                Token expires at {toReadableDate(currentSession.expires_at)}.
              </p>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-red-500">Danger Zone</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportChats}
              disabled={busyAction === "export"}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-60"
            >
              {busyAction === "export" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Export Chats
            </button>
            <button
              type="button"
              onClick={clearChats}
              disabled={busyAction === "clear-chats"}
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 disabled:opacity-60"
            >
              {busyAction === "clear-chats" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Clear Chats
            </button>
            <button
              type="button"
              onClick={deleteAccount}
              disabled={busyAction === "delete-account"}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs text-red-500 disabled:opacity-60"
            >
              {busyAction === "delete-account" ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
              Delete Account
            </button>
          </div>
        </section>

        {/* Account */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Account</h2>
          <p className="text-sm text-[var(--text-primary)]">{user?.name}</p>
          <p className="text-xs text-[var(--text-soft)]">{user?.email}</p>
          <button
            type="button"
            onClick={() => signOut().catch(() => null)}
            className="mt-3 inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </section>
      </div>
    </div>
  );
}

export default SettingsPanel;
