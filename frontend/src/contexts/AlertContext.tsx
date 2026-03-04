"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type AlertType = "error" | "success" | "info";

export interface AlertItem {
  id: string;
  type: AlertType;
  message: string;
}

interface AlertContextValue {
  alerts: AlertItem[];
  showAlert: (message: string, type?: AlertType) => void;
  removeAlert: (id: string) => void;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showAlert = useCallback((message: string, type: AlertType = "error") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setAlerts((prev) => [...prev, { id, type, message }]);

    window.setTimeout(() => {
      setAlerts((prev) => prev.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(
    () => ({ alerts, showAlert, removeAlert }),
    [alerts, showAlert, removeAlert]
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts(): AlertContextValue {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlerts must be used inside AlertProvider");
  }
  return context;
}
