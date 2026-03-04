"use client";

import { useEffect, useMemo, useState } from "react";

interface TypewriterTextProps {
  text: string;
  speedMs?: number;
}

export function TypewriterText({ text, speedMs = 12 }: TypewriterTextProps) {
  const [index, setIndex] = useState(0);
  const content = useMemo(() => text || "", [text]);

  // Dynamic speed adjustment: faster typing for longer blocks to keep UX snappy
  const adjustedSpeed = useMemo(() => {
    if (content.length > 500) return speedMs / 2;
    if (content.length > 200) return speedMs / 1.5;
    return speedMs;
  }, [content.length, speedMs]);

  useEffect(() => {
    if (!content || index >= content.length) return;

    const timer = window.setTimeout(() => {
      setIndex((prev) => prev + 1);
    }, adjustedSpeed);

    return () => window.clearTimeout(timer);
  }, [content, index, adjustedSpeed]);

  const isDone = index >= content.length;

  return (
    <div className="relative">
      <p className="m-0 whitespace-pre-wrap text-[14px] leading-relaxed tracking-normal text-[var(--text-main)] selection:bg-indigo-500/30">
        {content.slice(0, index)}
        {!isDone && (
          <span className="relative ml-0.5 inline-block h-[15px] w-[2px] translate-y-[2px] animate-pulse rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
        )}
      </p>
    </div>
  );
}
