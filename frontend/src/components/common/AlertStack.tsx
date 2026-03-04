"use client";

import { X, AlertCircle, CheckCircle2, Info } from "lucide-react";

import { type AlertItem as AlertItemType, useAlerts } from "@/contexts/AlertContext";

export function AlertStack() {
  const { alerts, removeAlert } = useAlerts();

  return (
    <div
      className="pointer-events-none fixed right-4 top-16 z-[120] flex w-full max-w-[340px] flex-col gap-2"
      aria-live="polite"
    >
      {alerts.map((item) => (
        <AlertItem key={item.id} item={item} onRemove={removeAlert} />
      ))}
    </div>
  );
}

function AlertItem({ item, onRemove }: { item: AlertItemType; onRemove: (id: string) => void }) {
  const config = {
    error: {
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      border: "border-red-500/20",
    },
    success: {
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      border: "border-emerald-500/20",
    },
    info: {
      icon: <Info className="h-4 w-4 text-[var(--brand)]" />,
      border: "border-[var(--brand)]/20",
    },
  };

  const { icon, border } = config[item.type as keyof typeof config] || config.info;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-[var(--surface-elevated)] p-3 shadow-md ${border}`}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <p className="flex-1 text-sm text-[var(--text-primary)]">{item.message}</p>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 rounded p-0.5 text-[var(--text-soft)] transition hover:text-[var(--text-primary)]"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
