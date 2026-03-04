"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Settings, Sun, LogOut, Info, MessageSquare, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AuthModal } from "@/components/auth/AuthModal";
import { useAlerts } from "@/contexts/AlertContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { APP_NAME } from "@/lib/constants";

const publicNavItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/about", label: "About", icon: Info },
];

const authNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const isChatPage = pathname.startsWith("/chat");

  const { isAuthenticated, user, signOut } = useAuth();
  const { showAlert } = useAlerts();
  const { theme, toggleTheme } = useTheme();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  const openWorkspaceSidebar = () => {
    window.dispatchEvent(new CustomEvent("swastik:toggle-workspace-sidebar", { detail: { open: true } }));
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      showAlert("You have been signed out successfully.", "success");
    } catch {
      showAlert("Failed to sign out. Please try again.");
    } finally {
      setLoggingOut(false);
      setLogoutModalOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md">
        <div className="flex h-12 items-center justify-between px-4">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={isChatPage ? openWorkspaceSidebar : () => setMobileNavOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)] md:hidden"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>

            <Link href="/chat" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand)] text-white">
                <span className="text-xs font-bold">S</span>
              </div>
              <span className="hidden text-sm font-semibold text-[var(--text-primary)] sm:block">{APP_NAME}</span>
            </Link>
          </div>

          {/* Center */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {[...publicNavItems, ...(isAuthenticated ? authNavItems : [])].map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-[var(--surface-alt)] font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-1.5" ref={profileRef}>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="flex h-8 items-center gap-2 rounded-lg px-1.5 text-[var(--text-primary)] transition hover:bg-[var(--surface-alt)]"
                  aria-label="Account menu"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-white">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span className="hidden max-w-[100px] truncate text-xs font-medium sm:inline">{user?.name}</span>
                </button>

                {profileOpen && (
                  <div className="animate-fade-in absolute right-0 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg">
                    <div className="border-b border-[var(--border)] px-3 py-2">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{user?.name}</p>
                      <p className="truncate text-xs text-[var(--text-soft)]">{user?.email}</p>
                    </div>
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Settings size={14} />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setLogoutModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/5"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--brand-hover)]"
              >
                <User size={14} />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      <div
        className={`fixed inset-0 z-[80] md:hidden ${mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileNavOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${mobileNavOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={`absolute left-0 top-0 h-full w-[280px] border-r border-[var(--border)] bg-[var(--background)] p-4 shadow-lg transition-transform ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{APP_NAME}</span>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="grid gap-1">
            {[...publicNavItems, ...(isAuthenticated ? authNavItems : [])].map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    active
                      ? "bg-[var(--surface-alt)] font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]"
                  }`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Auth Modal from Navbar */}
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Logout Confirmation Modal */}
      {logoutModalOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => !loggingOut && setLogoutModalOpen(false)}
        >
          <div
            className="modal-content w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <LogOut size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Sign Out</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Are you sure you want to sign out? Your chat history will be saved and available when you sign back in.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={() => setLogoutModalOpen(false)}
                  className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-alt)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loggingOut}
                  onClick={handleLogout}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                >
                  {loggingOut && (
                    <div className="spinner !h-4 !w-4 !border-2 !border-white/30 !border-t-white" />
                  )}
                  {loggingOut ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
