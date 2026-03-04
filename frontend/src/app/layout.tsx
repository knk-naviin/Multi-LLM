"use client";

import { Inter } from "next/font/google";
import { usePathname } from "next/navigation";

import { AlertStack } from "@/components/common/AlertStack";
import { Navbar } from "@/components/layout/Navbar";
import { AppProviders } from "@/components/providers/AppProviders";
import { THEME_KEY } from "@/lib/constants";

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

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatPage = pathname === "/chat" || pathname.startsWith("/chat/");

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Navbar />
      <main className="min-h-0 flex-1">{children}</main>
      <AlertStack />

      {!isChatPage && (
        <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-4 text-xs text-[var(--text-soft)]">
            <span>&copy; {new Date().getFullYear()} Swastik AI</span>
            <span className="text-[var(--border)]">&middot;</span>
            <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Terms</a>
            <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Privacy</a>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
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
