export type ModelName = "gpt" | "gemini" | "claude" | null;
export type ThemeName = "light" | "dark";
export type UiDensity = "comfortable" | "compact" | "spacious";
export type UiLanguage = "en" | "es" | "fr" | "de" | "ja" | "hi";

export interface AppSettings {
  preferred_model: ModelName;
  theme: ThemeName;
  auto_store_chats: boolean;
  show_model_info: boolean;
  language: UiLanguage;
  density: UiDensity;
  notifications: {
    email_digest: boolean;
    browser_push: boolean;
    product_updates: boolean;
    weekly_recap: boolean;
  };
  privacy: {
    share_analytics: boolean;
    improve_model: boolean;
  };
  security: {
    two_factor_enabled: boolean;
  };
}

export interface AuthSession {
  id: string;
  created_at?: string | null;
  expires_at?: string | null;
  current: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  settings?: {
    preferred_model?: ModelName;
    theme?: ThemeName;
    auto_store_chats?: boolean;
  };
}

export interface AgentChatMessage {
  agent: string;
  name: string;
  role: string;
  message: string;
  response_time: number;
  tokens: number;
  error?: string | null;
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelUsed?: string | null;
  detail?: string;
  loading?: boolean;
  animateTypewriter?: boolean;
  timestamp?: number;
  isBestAnswer?: boolean;
  agentChat?: AgentChatMessage[];
  synthesizedBy?: string;
  responseTimeSeconds?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface Folder {
  id: string;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatSummary {
  id: string;
  folder_id: string | null;
  project_id?: string | null;
  title: string;
  last_message: string;
  last_model: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  model_used?: string | null;
  created_at?: string;
}

export interface ChatThread {
  id: string;
  folder_id: string | null;
  project_id?: string | null;
  title: string;
  messages: ChatMessage[];
  created_at?: string;
  updated_at?: string;
}

/* ─── AI Council Types ─── */

export type CouncilAgent = "gpt" | "gemini" | "claude" | "grok";

export interface CouncilAgentInfo {
  key: CouncilAgent;
  name: string;
  role: string;
  color: string;
}

export interface CouncilMessage {
  id: string;
  type:
    | "user"
    | "agent_response"
    | "round_divider"
    | "vote_result"
    | "synthesis"
    | "typing"
    | "done";
  agent?: CouncilAgent;
  agentRole?: string;
  round?: number;
  roundName?: string;
  responseType?: string;
  content: string;
  responseTime?: number;
  tokens?: number;
  timestamp: number;
  votes?: Record<string, string>;
  tally?: Record<string, number>;
  error?: string;
  metrics?: CouncilAgentMetric[];
  totalTime?: number;
  totalTokens?: number;
}

export interface CouncilAgentMetric {
  agent: string;
  name: string;
  role: string;
  color: string;
  avg_response_time: number;
  total_tokens: number;
  errors: number;
  votes_received: number;
}

export interface ChatCompletionResponse {
  ok: boolean;
  selector: string;
  selector_source?: string;
  selector_confidence?: number;
  domain?: string;
  domain_ranking?: Array<{ domain: string; probability: number }>;
  model_selected: string;
  model_ranking: Array<Record<string, unknown>>;
  fallback_errors: string[];
  response_time_seconds: number;
  response: string;
  chat_id?: string | null;
}
