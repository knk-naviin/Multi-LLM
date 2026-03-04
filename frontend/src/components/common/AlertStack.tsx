"use client";

import { X, AlertCircle, CheckCircle2, Info } from "lucide-react";

import { type AlertItem as AlertItemType, useAlerts } from "@/contexts/AlertContext";

export function AlertStack() {
  const { alerts, removeAlert } = useAlerts();

  return (
    <div 
      className="fixed right-4 top-20 z-[120] flex flex-col gap-3 w-full max-w-[380px] pointer-events-none"
      aria-live="polite"
    >
      {alerts.map((item) => (
        <AlertItem key={item.id} item={item} onRemove={removeAlert} />
      ))}
    </div>
  );
}

function AlertItem({ item, onRemove }: { item: AlertItemType; onRemove: (id: string) => void }) {
  // Config for different alert tones
  const config = {
    error: {
      icon: <AlertCircle className="w-5 h-5 text-rose-500" />,
      classes: "border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10",
      label: "System Error"
    },
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      classes: "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10",
      label: "Success"
    },
    info: {
      icon: <Info className="w-5 h-5 text-indigo-500" />,
      classes: "border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10",
      label: "Notification"
    }
  };

  const { icon, classes, label } = config[item.type as keyof typeof config] || config.info;

  // Optional: Auto-remove logic could also live here if not in context
  
  return (
    <div
      className={`
        pointer-events-auto relative overflow-hidden rounded-2xl border p-4 pr-12 
        shadow-2xl backdrop-blur-xl transition-all duration-300
        animate-in slide-in-from-right-8 fade-in
        ${classes}
      `}
    >
      {/* Visual Accent Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.type === 'error' ? 'bg-rose-500' : item.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
      
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
            {label}
          </p>
          <p className="text-sm font-medium leading-relaxed text-[var(--text-main)]">
            {item.message}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="absolute right-3 top-3 p-1 rounded-lg text-[var(--text-soft)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
