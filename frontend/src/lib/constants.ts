export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Swastik Ai";
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "Gen 6";
export const AUTHOR_NAME = process.env.NEXT_PUBLIC_AUTHOR_NAME || "Naveen K";
export const CLIENT_ROUTER_KEY =
  process.env.NEXT_PUBLIC_CLIENT_ROUTER_KEY || "swastik_benchmark_router_v1";
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_I ||
  "";

export const TOKEN_KEY = "swastik.token";
export const THEME_KEY = "swastik.theme";
export const PREF_MODEL_KEY = "swastik.pref_model";
export const AUTO_STORE_KEY = "swastik.auto_store";
export const TOKEN_COOKIE = "swastik_token";
