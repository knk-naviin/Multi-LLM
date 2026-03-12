"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Sparkles,
  Layers,
  Settings,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  User,
  X,
  Menu,
} from "lucide-react";

import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAlerts } from "@/contexts/AlertContext";
import { BRAND_GRADIENT, BRAND_LOGO, BRAND_NAME } from "@/lib/brand";

const SIDEBAR_KEY = "swastik.sidebar.collapsed";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const mainNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/council", label: "AI Council", icon: Users },
  { href: "/custom-swastik", label: "Custom Swastik", icon: Sparkles },
  { href: "/task-mode", label: "Task Mode", icon: Layers },
];

const bottomNavItems: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isAuthenticated, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showAlert } = useAlerts();

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Initialize from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === "true") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  // Listen for external toggle (from command palette)
  useEffect(() => {
    const handler = () => {
      setCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(SIDEBAR_KEY, String(next));
        } catch {}
        return next;
      });
    };
    window.addEventListener("swastik:toggle-sidebar", handler);
    return () => window.removeEventListener("swastik:toggle-sidebar", handler);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

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

  const isActive = (href: string) => {
    if (href === "/dashboard")
      return pathname === "/" || pathname === "/dashboard";
    if (href === "/chat") return pathname.startsWith("/chat");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const sidebarWidth = collapsed ? "w-16" : "w-60";

  const renderNavItem = (item: NavItem, showTooltip = false) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`sidebar-nav-item ${active ? "active" : ""}`}
        onClick={() => setMobileOpen(false)}
      >
        <Icon size={18} />
        {!collapsed && <span>{item.label}</span>}
        {collapsed && showTooltip && (
          <span className="sidebar-tooltip">{item.label}</span>
        )}
      </Link>
    );
  };

  // Desktop sidebar
  const desktopSidebar = (
    <aside
      className={`hidden md:flex flex-col ${sidebarWidth} shrink-0 border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-all duration-200 ease-in-out`}
      style={{ height: "100dvh" }}
    >
      {/* Logo */}
      <div
        className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-4"} h-14 shrink-0 border-b border-[var(--border)]`}
      >
        <Image
          src={BRAND_LOGO}
          alt={BRAND_NAME}
          width={60}
          height={60}
          className="rounded-lg shrink-0"
          priority
        />
        {!collapsed && (
          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {BRAND_NAME}
          </span>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-2 py-3 space-y-0.5">
        {mainNavItems.map((item) => renderNavItem(item, true))}
      </nav>

      {/* Divider + bottom section */}
      <div className="shrink-0 border-t border-[var(--border)] px-2 py-2 space-y-0.5">
        {/* Settings (only when authenticated) */}
        {isAuthenticated &&
          bottomNavItems.map((item) => renderNavItem(item, true))}

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="sidebar-nav-item w-full"
          title={
            mounted
              ? `Switch to ${theme === "dark" ? "light" : "dark"} mode`
              : "Toggle theme"
          }
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )
          ) : (
            <div className="h-[18px] w-[18px]" />
          )}
          {!collapsed && (
            <span>
              {mounted
                ? theme === "dark"
                  ? "Light Mode"
                  : "Dark Mode"
                : "Theme"}
            </span>
          )}
          {collapsed && (
            <span className="sidebar-tooltip">
              {mounted
                ? theme === "dark"
                  ? "Light Mode"
                  : "Dark Mode"
                : "Theme"}
            </span>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={toggleCollapse}
          className="sidebar-nav-item w-full"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span>Collapse</span>}
          {collapsed && <span className="sidebar-tooltip">Expand</span>}
        </button>

        {/* User section */}
        {isAuthenticated ? (
          <div
            className={`flex items-center ${collapsed ? "justify-center" : "gap-2 px-2"} py-1.5`}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white cursor-pointer"
              style={{ background: BRAND_GRADIENT }}
              onClick={() => setLogoutModalOpen(true)}
              title={user?.name || "Account"}
            >
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                  {user?.name}
                </p>
                <p className="truncate text-[10px] text-[var(--text-soft)]">
                  {user?.email}
                </p>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="sidebar-nav-item w-full"
          >
            <User size={18} />
            {!collapsed && <span>Sign In</span>}
            {collapsed && <span className="sidebar-tooltip">Sign In</span>}
          </button>
        )}
      </div>
    </aside>
  );

  // Mobile overlay sidebar
  const mobileSidebar = (
    <div
      className={`fixed inset-0 z-[80] md:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!mobileOpen}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          mobileOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar panel */}
      <div
        className={`absolute left-0 top-0 h-full w-[280px] border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-lg transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <Image
              src={BRAND_LOGO}
              alt={BRAND_NAME}
              width={55}
              height={55}
              className="rounded-md"
            />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {BRAND_NAME}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="px-2 py-3 space-y-0.5">
          {mainNavItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${active ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--border)] px-2 py-2 space-y-0.5">
          {isAuthenticated &&
            bottomNavItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-item ${active ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

          <button
            type="button"
            onClick={toggleTheme}
            className="sidebar-nav-item w-full"
          >
            {mounted ? (
              theme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )
            ) : (
              <div className="h-[18px] w-[18px]" />
            )}
            <span>
              {mounted
                ? theme === "dark"
                  ? "Light Mode"
                  : "Dark Mode"
                : "Theme"}
            </span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: BRAND_GRADIENT }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                  {user?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setLogoutModalOpen(true);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-red-500"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setAuthModalOpen(true);
              }}
              className="sidebar-nav-item w-full"
            >
              <User size={18} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const isChatPage = pathname.startsWith("/chat");

  const handleMobileHamburger = () => {
    if (isChatPage) {
      // On chat page, open the chat workspace sidebar (which includes nav links)
      window.dispatchEvent(
        new CustomEvent("swastik:toggle-workspace-sidebar", {
          detail: { open: true },
        }),
      );
    } else {
      setMobileOpen(true);
    }
  };

  // Mobile top bar (hamburger button) — hidden on chat page since ChatWorkspace has its own header
  const mobileTopBar = isChatPage ? null : (
    <div className="flex md:hidden items-center h-12 shrink-0 px-3 border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md">
      <button
        type="button"
        onClick={handleMobileHamburger}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {BRAND_NAME}
        </span>
      </div>
      <div className="w-8" /> {/* Spacer for centering */}
    </div>
  );

  return (
    <>
      {desktopSidebar}
      {mobileTopBar}
      {mobileSidebar}

      {/* Auth Modal */}
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
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Sign Out
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Are you sure you want to sign out? Your data will be saved and
                available when you sign back in.
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
