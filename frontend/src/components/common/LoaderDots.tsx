"use client";

export function LoaderDots() {
  return (
    <div className="flex items-center gap-1 py-1" role="status" aria-label="Loading">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-soft)] [animation-duration:0.8s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-soft)] [animation-delay:0.15s] [animation-duration:0.8s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-soft)] [animation-delay:0.3s] [animation-duration:0.8s]" />
    </div>
  );
}
