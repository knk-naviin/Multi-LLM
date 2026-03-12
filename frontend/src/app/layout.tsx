"use client";

import { Inter } from "next/font/google";
import { useCallback, useEffect, useState } from "react";

import { AlertStack } from "@/components/common/AlertStack";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { AppProviders } from "@/components/providers/AppProviders";
import { THEME_KEY } from "@/lib/constants";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem('${THEME_KEY}');
    const theme = stored === 'dark' ? 'dark' : 'light';
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  } catch {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  }
})();
`;

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  const openCommandPalette = useCallback(() => setCmdPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setCmdPaletteOpen(false), []);

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative z-10 flex flex-col md:flex-row h-dvh overflow-hidden">
      {/* Sidebar — desktop persistent, mobile overlay */}
      <AppSidebar />

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onOpenCommandPalette={openCommandPalette} />

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      {/* Global overlays */}
      <AlertStack />
      <CommandPalette open={cmdPaletteOpen} onClose={closeCommandPalette} />
    </div>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-[var(--background)] font-sans antialiased">
        <AppProviders>
          <LayoutInner>{children}</LayoutInner>
        </AppProviders>
      </body>
    </html>
  );
}
