"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, Mail, User, X } from "lucide-react";

import { useAlerts } from "@/contexts/AlertContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { APP_NAME, GOOGLE_CLIENT_ID } from "@/lib/constants";

type Mode = "login" | "signup";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (container: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-identity='1']");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { showAlert } = useAlerts();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { theme } = useTheme();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const closeModal = useCallback((options?: { force?: boolean }) => {
    if (!options?.force && (submitting || googleLoading)) return;
    setName("");
    setEmail("");
    setPassword("");
    setMode("login");
    onClose();
  }, [googleLoading, onClose, submitting]);

  const onGoogleCredential = useCallback(
    async (credential: string) => {
      if (!credential || submitting || googleLoading) return;
      setGoogleLoading(true);
      try {
        await signInWithGoogle(credential);
        showAlert("Signed in with Google.", "success");
        closeModal({ force: true });
      } catch (error) {
        showAlert(error instanceof Error ? error.message : "Google sign-in failed");
      } finally {
        setGoogleLoading(false);
      }
    },
    [closeModal, googleLoading, showAlert, signInWithGoogle, submitting]
  );

  useEffect(() => {
    if (!open || !GOOGLE_CLIENT_ID || mode !== "login") return;

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (!cancelled && response.credential) {
              onGoogleCredential(response.credential);
            }
          },
        });

        googleButtonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: "300",
        });
      })
      .catch((error) => {
        if (!cancelled) {
          showAlert(error instanceof Error ? error.message : "Google sign-in is unavailable");
        }
      });

    return () => { cancelled = true; };
  }, [mode, onGoogleCredential, open, showAlert, theme]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || googleLoading) return;

    setSubmitting(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        showAlert("Signed in successfully.", "success");
      } else {
        await signUp(name, email, password);
        showAlert("Account created successfully.", "success");
      }
      closeModal({ force: true });
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => closeModal()}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6">
          <button
            type="button"
            onClick={() => closeModal()}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-soft)]">
            {mode === "login" ? `Sign in to ${APP_NAME}` : "Create an account to sync your workspace."}
          </p>

          {/* Tab toggle */}
          <div className="mt-4 grid grid-cols-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-0.5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                mode === "login"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-soft)] hover:text-[var(--text-primary)]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                mode === "signup"
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-soft)] hover:text-[var(--text-primary)]"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form className="mt-4 grid gap-3" onSubmit={submit}>
            {mode === "signup" && (
              <label className="grid gap-1 text-xs text-[var(--text-soft)]">
                Full Name
                <span className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                  <User size={14} className="text-[var(--text-soft)]" />
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)]"
                    placeholder="Your name"
                  />
                </span>
              </label>
            )}

            <label className="grid gap-1 text-xs text-[var(--text-soft)]">
              Email
              <span className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                <Mail size={14} className="text-[var(--text-soft)]" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)]"
                  placeholder="you@example.com"
                />
              </span>
            </label>

            <label className="grid gap-1 text-xs text-[var(--text-soft)]">
              Password
              <span className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                <Lock size={14} className="text-[var(--text-soft)]" />
                <input
                  required
                  minLength={8}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)]"
                  placeholder="Minimum 8 characters"
                />
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting || googleLoading}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {mode === "login" && (
            <>
              <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-[var(--text-soft)]">
                <span className="h-px flex-1 bg-[var(--border)]" />
                or
                <span className="h-px flex-1 bg-[var(--border)]" />
              </div>

              {GOOGLE_CLIENT_ID ? (
                <div className="flex justify-center">
                  <div ref={googleButtonRef} className="min-h-[40px]" />
                </div>
              ) : (
                <p className="text-center text-xs text-[var(--text-soft)]">
                  Google sign-in is disabled.
                </p>
              )}
            </>
          )}

          <p className="mt-4 text-center text-[10px] text-[var(--text-soft)]">
            By continuing, you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
