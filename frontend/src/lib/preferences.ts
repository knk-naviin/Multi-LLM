import { AUTO_STORE_KEY, PREF_MODEL_KEY, SHOW_MODEL_INFO_KEY } from "@/lib/constants";
import type { ModelName } from "@/lib/types";

export function getPreferredModel(): ModelName {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(PREF_MODEL_KEY);
  if (!value || value === "auto") {
    return null;
  }
  if (value === "gpt" || value === "gemini" || value === "claude") {
    return value;
  }
  return null;
}

export function setPreferredModel(model: ModelName): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PREF_MODEL_KEY, model ?? "auto");
}

export function getAutoStore(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const value = window.localStorage.getItem(AUTO_STORE_KEY);
  if (value == null) {
    return true;
  }
  return value === "true";
}

export function setAutoStore(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTO_STORE_KEY, enabled ? "true" : "false");
}

export function getShowModelInfo(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const value = window.localStorage.getItem(SHOW_MODEL_INFO_KEY);
  if (value == null) {
    return true;
  }
  return value === "true";
}

export function setShowModelInfo(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SHOW_MODEL_INFO_KEY, enabled ? "true" : "false");
}
