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
  isTaskMode?: boolean;
  taskType?: string;
  workflowChat?: WorkflowStepMessage[];
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

/* ─── Task Mode Types ─── */

export interface TaskRole {
  key: string;
  label: string;
  description: string;
}

export interface TaskTypeConfig {
  key: string;
  label: string;
  icon: string;
  roles: TaskRole[];
}

export interface WorkflowStepMessage {
  role_key: string;
  role_label: string;
  agent: string;
  agent_name: string;
  message: string;
  response_time: number;
  tokens: number;
  error?: string | null;
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

/* ─── Sequential Debate Types ─── */

export type DebateStance = "initiate" | "agree" | "oppose" | "partial_agree" | "review";

export interface DebateMessage {
  id: string;
  type: "user" | "debate_response" | "synthesis" | "typing" | "done";
  agent?: CouncilAgent;
  agentName?: string;
  agentRole?: string;
  content: string;
  stance?: DebateStance;
  references?: string[];
  sequence?: number;
  totalAgents?: number;
  responseTime?: number;
  tokens?: number;
  timestamp: number;
  error?: string;
  metrics?: CouncilAgentMetric[];
  totalTime?: number;
  totalTokens?: number;
}

/* ─── Task Workflow (Iterative Streaming) Types ─── */

export interface TimelineStep {
  id: string;
  step: string;
  stepLabel: string;
  agent: string;
  agentName?: string;
  iteration: number;
  status: "pending" | "in_progress" | "completed" | "failed" | "revision";
  content?: string;
  responseTime?: number;
  tokens?: number;
  error?: string;
  feedbackMessage?: string;
}

export interface AgentConversationMessage {
  id: string;
  step: string;
  stepLabel: string;
  agent: string;
  agentName: string;
  content: string;
  responseTime: number;
  tokens: number;
  error?: string;
  iteration: number;
}

export interface TaskWorkflowRole {
  key: string;
  label: string;
  description: string;
  agent: string;
}

/* ─── Task Workflow History / Replay Types ─── */

export interface TaskWorkflowSummary {
  id: string;
  task_prompt: string;
  task_type: string;
  task_label: string;
  total_time: number;
  total_tokens: number;
  steps_count: number;
  status: "completed" | "failed";
  created_at: string;
  has_followup?: boolean;
}

export interface TaskWorkflowFull extends TaskWorkflowSummary {
  agents: Record<string, string>;
  events: Array<Record<string, unknown>>;
  final_result: {
    content: string;
    agent: string;
    agent_name: string;
  } | null;
  followup_chat?: FollowUpMessage[];
}

/* ─── Task Follow-Up Chat Types ─── */

export interface FollowUpMessage {
  role: "user" | "assistant";
  content: string;
  model_used?: string | null;
  created_at?: string;
}

export interface TaskFollowUpResponse {
  ok: boolean;
  reply: string;
  model_used: string;
  response_time_seconds: number;
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
