"use client";

import { APP_NAME } from "@/lib/constants";
import { Sparkles } from "lucide-react";

interface LoaderDotsProps {
  label?: string;
}

export function LoaderDots({ 
  label = `${APP_NAME} is processing` 
}: LoaderDotsProps) {
  return (
    <div 
      className="flex items-center gap-3 py-1.5 px-1" 
      role="status" 
      aria-label={label}
    >
      {/* Icon with subtle spin/pulse */}
      <div className="relative flex h-5 w-5 items-center justify-center">
        <Sparkles 
          size={14} 
          className="text-indigo-500 animate-pulse" 
        />
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-soft)] opacity-80">
          {label}
        </span>
        
        {/* Modern Dot Sequence */}
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce [animation-duration:1s]" />
          <span className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce [animation-duration:1s] [animation-delay:0.2s]" />
          <span className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce [animation-duration:1s] [animation-delay:0.4s]" />
        </div>
      </div>
    </div>
  );
}