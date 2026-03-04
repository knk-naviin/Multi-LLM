"use client";

export function LoaderDots() {
  return (
    <div className="flex items-center gap-2 py-1" role="status" aria-label="Loading">
      <span className="thinking-cursor" />
    </div>
  );
}
