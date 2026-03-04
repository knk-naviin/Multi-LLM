"use client";

import { Inter } from "next/font/google";

import { AlertStack } from "@/components/common/AlertStack";
import { Navbar } from "@/components/layout/Navbar";
import { AppProviders } from "@/components/providers/AppProviders";
import { AUTHOR_NAME, COMPANY_NAME, THEME_KEY } from "@/lib/constants";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem('${THEME_KEY}');
    const theme = stored === 'light' ? 'light' : 'dark';
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="relative min-h-screen overflow-x-hidden bg-[var(--background)] font-sans antialiased selection:bg-indigo-500/25">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0" style={{ background: "var(--ambient-gradient)" }} />
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(var(--grid-line-color) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line-color) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)",
            }}
          />
        </div>

        <AppProviders>
          <div className="relative z-10 flex min-h-screen flex-col">
            <Navbar />
            <main className="min-h-0 flex-1">{children}</main>
            <AlertStack />

            <footer className="shrink-0 border-t border-[var(--stroke)] bg-[var(--background)]/60 px-4 py-3 backdrop-blur-sm">
              <div className="mx-auto flex max-w-[1540px] flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                <div className="flex items-center gap-3">
                  <span>© 2026 {COMPANY_NAME}</span>
                  <a href="#" className="hover:text-[var(--text-main)]">
                    Terms
                  </a>
                  <a href="#" className="hover:text-[var(--text-main)]">
                    Privacy
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Operational · {AUTHOR_NAME}</span>
                </div>
              </div>
            </footer>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
