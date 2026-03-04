"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Settings, Sun, UserCircle2, X, LogOut, Info, MessageSquare, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";

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
      if (!profileRef.current) {
        return;
      }

      if (!profileRef.current.contains(event.target as Node)) {
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
      <header className="sticky top-0 z-50 w-full border-b border-[var(--stroke)] bg-[var(--background)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1540px] items-center justify-between px-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isChatPage ? openWorkspaceSidebar : () => setMobileNavOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--stroke)] bg-[var(--surface)] text-[var(--text-main)] md:hidden"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>

            <Link href="/chat" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
                <span className="text-lg font-black tracking-tighter">S</span>
              </div>
              <div className="hidden flex-col sm:flex">
                <span className="text-sm font-bold tracking-tight text-[var(--text-main)]">{APP_NAME}</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-soft)] opacity-70">
                  {COMPANY_NAME}
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[var(--surface-alt)] text-[var(--text-main)]"
                      : "text-[var(--text-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-main)]"
                  }`}
                >
                  <Icon size={16} className={active ? "text-indigo-500" : "opacity-70"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3" ref={profileRef}>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--stroke)] bg-[var(--surface)] text-[var(--text-soft)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--text-main)]"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-2.5 text-[var(--text-main)] transition hover:border-indigo-500/50"
                  aria-label="Account menu"
                >
                  <UserCircle2 size={17} />
                  <span className="hidden max-w-[120px] truncate text-xs font-semibold sm:inline">{user?.name}</span>
                </button>

                {profileOpen ? (
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-[var(--stroke)] bg-[var(--surface)] p-1 shadow-xl">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[var(--text-main)]">{user?.name}</p>
                      <p className="truncate text-xs text-[var(--text-soft)]">{user?.email}</p>
                    </div>
                    <Link
                      href="/settings"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-alt)]"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Settings size={15} />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        signOut().catch(() => null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-500/10"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link
                href="/chat?auth=1"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:opacity-95 sm:px-4 sm:text-sm"
              >
                <User size={14} />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[80] md:hidden ${mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileNavOpen}
      >
        <div
          className={`absolute inset-0 bg-black/45 transition-opacity ${mobileNavOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileNavOpen(false)}
        />
        <div
          className={`absolute left-0 top-0 h-full w-[84%] max-w-[320px] border-r border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-2xl transition-transform ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--text-main)]">Menu</p>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--stroke)] bg-[var(--surface-alt)] text-[var(--text-main)]"
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
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    active
                      ? "bg-[var(--surface-alt)] font-semibold text-[var(--text-main)]"
                      : "text-[var(--text-soft)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-main)]"
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
