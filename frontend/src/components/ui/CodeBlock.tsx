"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

/* ─── Language display map ─── */
const LANGUAGE_LABELS: Record<string, string> = {
  js: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  tsx: "TSX",
  py: "Python",
  python: "Python",
  rb: "Ruby",
  go: "Go",
  rs: "Rust",
  java: "Java",
  kt: "Kotlin",
  swift: "Swift",
  cs: "C#",
  csharp: "C#",
  cpp: "C++",
  c: "C",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  xml: "XML",
  sql: "SQL",
  sh: "Shell",
  bash: "Bash",
  zsh: "Zsh",
  powershell: "PowerShell",
  dockerfile: "Dockerfile",
  docker: "Dockerfile",
  graphql: "GraphQL",
  md: "Markdown",
  markdown: "Markdown",
  toml: "TOML",
  ini: "INI",
  makefile: "Makefile",
  php: "PHP",
  r: "R",
  dart: "Dart",
  lua: "Lua",
  elixir: "Elixir",
  haskell: "Haskell",
  scala: "Scala",
  perl: "Perl",
  text: "Plain Text",
};

function getLanguageLabel(lang: string): string {
  const lower = lang.toLowerCase();
  return LANGUAGE_LABELS[lower] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

/* ─── Custom dark theme based on VS Code ─── */
const customDarkTheme: Record<string, React.CSSProperties> = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...(oneDark['pre[class*="language-"]'] as React.CSSProperties),
    background: "#1e1e1e",
    margin: 0,
    padding: "1rem",
    fontSize: "13px",
    lineHeight: "1.6",
    borderRadius: 0,
  },
  'code[class*="language-"]': {
    ...(oneDark['code[class*="language-"]'] as React.CSSProperties),
    background: "none",
    fontSize: "13px",
    lineHeight: "1.6",
    fontFamily:
      "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
};

/* ─── Light theme ─── */
const customLightTheme: Record<string, React.CSSProperties> = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...(oneDark['pre[class*="language-"]'] as React.CSSProperties),
    background: "#f5f5f5",
    margin: 0,
    padding: "1rem",
    fontSize: "13px",
    lineHeight: "1.6",
    borderRadius: 0,
    color: "#1e1e1e",
  },
  'code[class*="language-"]': {
    ...(oneDark['code[class*="language-"]'] as React.CSSProperties),
    background: "none",
    fontSize: "13px",
    lineHeight: "1.6",
    color: "#1e1e1e",
    fontFamily:
      "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
  comment: { color: "#6a737d", fontStyle: "italic" },
  prolog: { color: "#6a737d" },
  doctype: { color: "#6a737d" },
  cdata: { color: "#6a737d" },
  punctuation: { color: "#393A34" },
  property: { color: "#36acaa" },
  tag: { color: "#22863a" },
  boolean: { color: "#005cc5" },
  number: { color: "#005cc5" },
  constant: { color: "#005cc5" },
  symbol: { color: "#005cc5" },
  deleted: { color: "#d73a49" },
  selector: { color: "#6f42c1" },
  "attr-name": { color: "#6f42c1" },
  string: { color: "#032f62" },
  char: { color: "#032f62" },
  builtin: { color: "#6f42c1" },
  inserted: { color: "#22863a" },
  operator: { color: "#d73a49" },
  entity: { color: "#22863a" },
  url: { color: "#22863a" },
  atrule: { color: "#d73a49" },
  "attr-value": { color: "#032f62" },
  keyword: { color: "#d73a49" },
  function: { color: "#6f42c1" },
  "class-name": { color: "#6f42c1" },
  regex: { color: "#032f62" },
  important: { color: "#d73a49", fontWeight: "bold" },
  variable: { color: "#e36209" },
};

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "text" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const displayLang = getLanguageLabel(language);

  return (
    <div className="code-block-wrapper my-3 overflow-hidden rounded-lg border border-[var(--border)] max-w-full">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1.5">
        <span
          className="text-[11px] font-medium text-[var(--text-muted)]"
          style={{
            fontFamily:
              "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
          }}
        >
          {displayLang}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-500" />
              <span className="text-emerald-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language === "text" ? "plaintext" : language}
          style={
            typeof window !== "undefined" &&
            document.documentElement.getAttribute("data-theme") === "dark"
              ? customDarkTheme
              : customLightTheme
          }
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: "var(--code-bg, #f5f5f5)",
          }}
          codeTagProps={{
            style: {
              fontFamily:
                "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
            },
          }}
          showLineNumbers={false}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

/* ─── Inline code component ─── */
export function InlineCode({ children }: { children?: React.ReactNode }) {
  return (
    <code
      className="rounded border border-[var(--border)] bg-[var(--surface-alt)] px-1.5 py-0.5 text-[12.5px] text-[var(--text-primary)]"
      style={{
        fontFamily:
          "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
      }}
    >
      {children}
    </code>
  );
}
