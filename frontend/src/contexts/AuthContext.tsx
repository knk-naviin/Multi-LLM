"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { TOKEN_COOKIE, TOKEN_KEY } from "@/lib/constants";
import type { User } from "@/lib/types";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signInWithGoogle: (credential: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

function readCookieToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const parts = document.cookie.split(";").map((segment) => segment.trim());
  const tokenEntry = parts.find((part) => part.startsWith(`${TOKEN_COOKIE}=`));
  if (!tokenEntry) {
    return null;
  }
  const raw = tokenEntry.slice(TOKEN_COOKIE.length + 1);
  return decodeURIComponent(raw || "");
}

function setAuthCookie(token: string | null): void {
  if (typeof document === "undefined") {
    return;
  }
  if (token) {
    document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
    return;
  }
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

interface AuthResponse {
  ok: boolean;
  token: string;
  user: User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken() || readCookieToken());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(getStoredToken() || readCookieToken()));

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY) {
        return;
      }

      const nextToken = event.newValue;
      if (!nextToken) {
        setAuthCookie(null);
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setToken(nextToken);
      setLoading(true);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!token) {
      setAuthCookie(null);
      return;
    }

    setAuthCookie(token);

    let mounted = true;
    apiRequest<{ ok: boolean; user: User }>("/api/auth/me", { token })
      .then((response) => {
        if (!mounted) {
          return;
        }
        setUser(response.user);
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(TOKEN_KEY);
          }
          setToken(null);
          setUser(null);
          setAuthCookie(null);
          return;
        }

        // For transient network/server errors, keep current auth state instead of force-logout.
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const persistAuth = (nextToken: string, nextUser: User) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_KEY, nextToken);
    }
    setAuthCookie(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setLoading(false);
  };

  const signIn = async (email: string, password: string): Promise<User> => {
    const response = await apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    persistAuth(response.token, response.user);
    return response.user;
  };

  const signInWithGoogle = async (credential: string): Promise<User> => {
    const response = await apiRequest<AuthResponse>("/api/auth/google", {
      method: "POST",
      body: { credential },
    });
    persistAuth(response.token, response.user);
    return response.user;
  };

  const signUp = async (name: string, email: string, password: string): Promise<User> => {
    const response = await apiRequest<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: { name, email, password },
    });
    persistAuth(response.token, response.user);
    return response.user;
  };

  const signOut = async () => {
    if (token) {
      try {
        await apiRequest<{ ok: boolean }>("/api/auth/logout", {
          method: "POST",
          token,
        });
      } catch {
        // Continue local logout even if server token is expired.
      }
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
    }
    setAuthCookie(null);
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  const refreshMe = async () => {
    if (!token) {
      setUser(null);
      return;
    }

    const response = await apiRequest<{ ok: boolean; user: User }>("/api/auth/me", { token });
    setUser(response.user);
  };

  const value: AuthContextValue = {
    token,
    user,
    loading,
    isAuthenticated: Boolean(token && user),
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
