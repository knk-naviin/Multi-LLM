"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Settings, Sun, LogOut, Info, MessageSquare, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { APP_NAME } from "@/lib/constants";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/about", label: "About", icon: Info },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();
  const isChatPage = pathname.startsWith("/chat");

  const { isAuthenticated, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
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
            {navItems.map((item) => {
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
                  <div className="absolute right-0 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg">
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
                        signOut().catch(() => null);
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
              <Link
                href="/chat?auth=1"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--brand-hover)]"
              >
                <User size={14} />
                Sign In
              </Link>
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
            {navItems.map((item) => {
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
    </>
  );
}
