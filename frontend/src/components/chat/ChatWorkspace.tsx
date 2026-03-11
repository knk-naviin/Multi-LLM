"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, Plus, ChevronDown, ChevronRight, FolderOpen, Home, AlertTriangle } from "lucide-react";

import { AuthModal } from "@/components/auth/AuthModal";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TaskModePanel } from "@/components/chat/TaskModePanel";
import { LoaderDots } from "@/components/common/LoaderDots";
import { useAlerts } from "@/contexts/AlertContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api";
import { APP_NAME, CLIENT_ROUTER_KEY } from "@/lib/constants";
import {
  getAutoStore,
  getPreferredModel,
  getShowModelInfo,
  setAutoStore,
  setPreferredModel,
  setShowModelInfo as saveShowModelInfo,
} from "@/lib/preferences";
import type {
  AgentChatMessage,
  ChatCompletionResponse,
  ChatSummary,
  ChatThread,
  Folder,
  ModelName,
  UiMessage,
  WorkflowStepMessage,
} from "@/lib/types";

/* ─── Session persistence keys ─── */
const SESSION_CHAT_ID = "swastik.session.chatId";
const SESSION_CHAT_TITLE = "swastik.session.chatTitle";
const SESSION_MESSAGES = "swastik.session.messages";
const SESSION_FOLDER_ID = "swastik.session.folderId";

function saveSession(chatId: string | null, title: string | null, messages: UiMessage[], folderId: string | null) {
  try {
    sessionStorage.setItem(SESSION_CHAT_ID, chatId || "");
    sessionStorage.setItem(SESSION_CHAT_TITLE, title || "");
    sessionStorage.setItem(SESSION_FOLDER_ID, folderId || "");
    // Only store if there are real messages (not just welcome)
    const hasRealMessages = messages.some((m) => m.id !== "welcome-assistant");
    if (hasRealMessages) {
      // Strip transient flags so restored messages render instantly (no re-animation)
      const cleaned = messages
        .filter((m) => !m.loading && !m.isStreaming) // drop any in-flight loading/streaming placeholders
        .map((m) => ({
          ...m,
          animateTypewriter: false,
          isStreaming: false,
        }));
      sessionStorage.setItem(SESSION_MESSAGES, JSON.stringify(cleaned));
    } else {
      sessionStorage.removeItem(SESSION_MESSAGES);
    }
  } catch {
    // sessionStorage might be unavailable
  }
}

function loadSession(): { chatId: string | null; title: string | null; messages: UiMessage[] | null; folderId: string | null } {
  try {
    const chatId = sessionStorage.getItem(SESSION_CHAT_ID) || null;
    const title = sessionStorage.getItem(SESSION_CHAT_TITLE) || null;
    const folderId = sessionStorage.getItem(SESSION_FOLDER_ID) || null;
    const raw = sessionStorage.getItem(SESSION_MESSAGES);
    const messages = raw ? JSON.parse(raw) as UiMessage[] : null;
    return { chatId, title, messages, folderId };
  } catch {
    return { chatId: null, title: null, messages: null, folderId: null };
  }
}

/* ─── Constants ─── */

const welcomeMessage: UiMessage = {
  id: "welcome-assistant",
  role: "assistant",
  content: `Welcome to **${APP_NAME}**. Ask me anything — I'll route your question to the best model automatically.`,
  modelUsed: "benchmarkModel",
  detail: `${CLIENT_ROUTER_KEY}`,
};

function messageFromThread(message: ChatThread["messages"][number], index: number): UiMessage {
  return {
    id: `thread-${index}-${message.created_at || index}`,
    role: message.role,
    content: message.content,
    modelUsed: message.model_used,
    detail: message.role === "assistant" ? "Stored" : undefined,
    animateTypewriter: false,
    timestamp: message.created_at ? new Date(message.created_at).getTime() : undefined,
  };
}

type SidebarEvent = CustomEvent<{ open?: boolean }>;

const MODEL_OPTIONS: { value: ModelName | "auto"; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "gpt", label: "GPT" },
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
];

const LOADING_MESSAGES = [
  "Selecting best model...",
  "Analyzing your prompt...",
  "Routing to optimal AI...",
  "Generating response...",
];

const BEST_ANSWER_LOADING = [
  "Our AI agents are collaborating...",
  "Multiple models analyzing your question...",
  "Agents discussing their perspectives...",
  "Synthesizing the best answer...",
];

const TASK_MODE_LOADING = [
  "Assembling your AI team...",
  "Running Step 1 of the workflow...",
  "Agents are collaborating sequentially...",
  "Progressing through the pipeline...",
  "Synthesizing the final result...",
];

function SkeletonMessage() {
  return (
    <div className="animate-fade-in py-2">
      <div className="space-y-2.5">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-4 w-2/3" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-3 w-12" />
      </div>
    </div>
  );
}

function ChatWorkspace() {
  const { showAlert } = useAlerts();
  const { token, user, isAuthenticated, loading: authLoading } = useAuth();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentChatTitle, setCurrentChatTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([welcomeMessage]);

  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [storeEnabled, setStoreEnabled] = useState<boolean>(true);
  const [preferredModel, setPreferredModelState] = useState<ModelName>(null);
  const [showModelInfo, setShowModelInfoState] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(LOADING_MESSAGES[0]);
  const [bestAnswerMode, setBestAnswerMode] = useState(false);
  const [taskModeOpen, setTaskModeOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const sessionRestoredRef = useRef(false);
  const loadingMsgIndexRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedFolder = useMemo(
    () => folders.find((f) => f.id === selectedFolderId),
    [folders, selectedFolderId]
  );

  // Persist session whenever chat state changes
  useEffect(() => {
    if (sessionRestoredRef.current) {
      saveSession(currentChatId, currentChatTitle, messages, selectedFolderId);
    }
  }, [currentChatId, currentChatTitle, messages, selectedFolderId]);

  const loadChats = useCallback(
    async (folderId: string | null) => {
      if (!isAuthenticated || !token) {
        setChats([]);
        return;
      }

      const query = folderId ? `/api/chats?folder_id=${encodeURIComponent(folderId)}` : "/api/chats";
      const data = await apiRequest<{ ok: boolean; chats: ChatSummary[] }>(query, { token });
      setChats(data.chats || []);
      setCurrentChatTitle((prev) => {
        if (!currentChatId) return prev;
        const match = data.chats?.find((chat) => chat.id === currentChatId);
        return match?.title || prev;
      });
    },
    [currentChatId, isAuthenticated, token]
  );

  // Restore session on mount
  useEffect(() => {
    setStoreEnabled(getAutoStore());
    setPreferredModelState(getPreferredModel());
    setShowModelInfoState(getShowModelInfo());

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "1" || params.get("authRequired") === "1") {
      setAuthModalOpen(true);
    }

    // Restore previous chat state if coming back from another tab
    const session = loadSession();
    if (session.messages && session.messages.length > 0) {
      setMessages(session.messages);
      setCurrentChatId(session.chatId);
      setCurrentChatTitle(session.title);
      if (session.folderId) setSelectedFolderId(session.folderId);
    }

    sessionRestoredRef.current = true;
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const handleSidebarToggle = (event: Event) => {
      const custom = event as SidebarEvent;
      const next = custom.detail?.open;
      setMobileSidebarOpen((prev) => (typeof next === "boolean" ? next : !prev));
    };

    window.addEventListener("swastik:toggle-workspace-sidebar", handleSidebarToggle as EventListener);
    return () => {
      window.removeEventListener("swastik:toggle-workspace-sidebar", handleSidebarToggle as EventListener);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setFolders([]);
      setChats([]);
      setSelectedFolderId(null);
      setCurrentChatId(null);
      setCurrentChatTitle(null);
      return;
    }

    const load = async () => {
      const [folderRes, settingsRes] = await Promise.all([
        apiRequest<{ ok: boolean; folders: Folder[] }>("/api/folders", { token }),
        apiRequest<{
          ok: boolean;
          settings: {
            preferred_model?: ModelName;
            auto_store_chats?: boolean;
            show_model_info?: boolean;
          };
        }>("/api/settings", { token }),
      ]);

      setFolders(folderRes.folders);

      const pref = settingsRes.settings?.preferred_model ?? getPreferredModel();
      const autoStore = settingsRes.settings?.auto_store_chats ?? getAutoStore();
      const modelInfo = settingsRes.settings?.show_model_info ?? getShowModelInfo();
      setPreferredModelState(pref || null);
      setStoreEnabled(Boolean(autoStore));
      setShowModelInfoState(modelInfo !== false);
      setPreferredModel(pref || null);
      setAutoStore(Boolean(autoStore));
      saveShowModelInfo(modelInfo !== false);
    };

    load().catch((error) => {
      showAlert(error instanceof Error ? error.message : "Failed to load account data");
    });
  }, [isAuthenticated, token, showAlert]);

  useEffect(() => {
    loadChats(selectedFolderId).catch((error) => {
      showAlert(error instanceof Error ? error.message : "Failed to load chats");
    });
  }, [loadChats, selectedFolderId, showAlert]);

  // Cycle loading messages while waiting for response
  const loadingSourceRef = useRef<"normal" | "best" | "task">("normal");

  useEffect(() => {
    if (!sending) return;
    const source = taskModeOpen ? "task" : bestAnswerMode ? "best" : "normal";
    loadingSourceRef.current = source;

    const msgs =
      source === "task"
        ? TASK_MODE_LOADING
        : source === "best"
          ? BEST_ANSWER_LOADING
          : LOADING_MESSAGES;

    loadingMsgIndexRef.current = 0;
    setLoadingDetail(msgs[0]);

    const delay = source === "task" ? 5000 : source === "best" ? 4000 : 2500;

    const interval = setInterval(() => {
      loadingMsgIndexRef.current = (loadingMsgIndexRef.current + 1) % msgs.length;
      setLoadingDetail(msgs[loadingMsgIndexRef.current]);
    }, delay);

    return () => clearInterval(interval);
  }, [sending, bestAnswerMode, taskModeOpen]);

  // Listen for settings changes (e.g. show_model_info toggled in settings page)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "swastik.show_model_info") {
        setShowModelInfoState(e.newValue !== "false");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const selectChat = async (chatId: string) => {
    if (!token) return;

    setLoadingChat(true);
    try {
      const data = await apiRequest<{ ok: boolean; chat: ChatThread }>(`/api/chats/${chatId}`, { token });
      setCurrentChatId(chatId);
      setCurrentChatTitle(data.chat.title || "Conversation");

      const folderId = data.chat.folder_id || data.chat.project_id || null;
      if (folderId && folderId !== selectedFolderId) {
        setSelectedFolderId(folderId);
      }

      const mapped = data.chat.messages.map(messageFromThread);
      setMessages(mapped.length ? mapped : [welcomeMessage]);
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to open chat");
    } finally {
      setLoadingChat(false);
    }
  };

  const createFolder = async () => {
    if (!isAuthenticated || !token) {
      showAlert("Sign in first to create folders.");
      setAuthModalOpen(true);
      return;
    }

    const name = folderName.trim();
    if (name.length < 2) {
      showAlert("Folder name must be at least 2 characters.");
      return;
    }

    try {
      const created = await apiRequest<{ ok: boolean; folder: Folder }>("/api/folders", {
        method: "POST",
        token,
        body: { name, description: "Workspace folder" },
      });
      setFolderName("");

      const updated = await apiRequest<{ ok: boolean; folders: Folder[] }>("/api/folders", { token });
      setFolders(updated.folders);
      setSelectedFolderId(created.folder.id);
      showAlert("Folder created.", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to create folder");
    }
  };

  const renameFolder = async (folderId: string, newName: string) => {
    if (!token) return;
    try {
      await apiRequest<{ ok: boolean }>(`/api/folders/${folderId}`, {
        method: "PATCH",
        token,
        body: { name: newName },
      });
      const updated = await apiRequest<{ ok: boolean; folders: Folder[] }>("/api/folders", { token });
      setFolders(updated.folders);
      showAlert("Folder renamed.", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to rename folder");
    }
  };

  const deleteFolder = (folderId: string) => {
    if (!token) return;
    setConfirmModal({
      title: "Delete Folder",
      message: "Are you sure you want to delete this folder? Chats inside will be moved to All Chats.",
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await apiRequest<{ ok: boolean }>(`/api/folders/${folderId}`, {
            method: "DELETE",
            token,
          });
          if (selectedFolderId === folderId) {
            setSelectedFolderId(null);
          }
          const updated = await apiRequest<{ ok: boolean; folders: Folder[] }>("/api/folders", { token });
          setFolders(updated.folders);
          await loadChats(selectedFolderId === folderId ? null : selectedFolderId);
          showAlert("Folder deleted.", "success");
        } catch (error) {
          showAlert(error instanceof Error ? error.message : "Failed to delete folder");
        }
      },
    });
  };

  const deleteChat = (chatId: string) => {
    if (!token) return;
    setConfirmModal({
      title: "Delete Chat",
      message: "Are you sure you want to delete this chat? This action cannot be undone.",
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await apiRequest<{ ok: boolean }>(`/api/chats/${chatId}`, {
            method: "DELETE",
            token,
          });
          if (currentChatId === chatId) {
            startNewChat();
          }
          await loadChats(selectedFolderId);
          showAlert("Chat deleted.", "success");
        } catch (error) {
          showAlert(error instanceof Error ? error.message : "Failed to delete chat");
        }
      },
    });
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    if (!token) return;
    try {
      await apiRequest<{ ok: boolean }>(`/api/chats/${chatId}`, {
        method: "PATCH",
        token,
        body: { title: newTitle },
      });
      if (currentChatId === chatId) {
        setCurrentChatTitle(newTitle);
      }
      await loadChats(selectedFolderId);
      showAlert("Chat renamed.", "success");
    } catch (error) {
      showAlert(error instanceof Error ? error.message : "Failed to rename chat");
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setCurrentChatTitle(null);
    setMessages([welcomeMessage]);
  };

  // Auto-generate chat title via model (fire and forget)
  const generateChatTitle = useCallback(
    async (userPrompt: string, assistantResponse: string) => {
      try {
        const titleResponse = await apiRequest<ChatCompletionResponse>("/api/chat/complete", {
          method: "POST",
          token,
          body: {
            prompt: `Generate a concise 3-6 word title for this conversation. Reply with ONLY the title, nothing else.\n\nUser: ${userPrompt}\nAssistant: ${assistantResponse.slice(0, 200)}`,
            forced_model: "gemini",
            store: false,
          },
        });

        const title = titleResponse.response
          .replace(/^["']|["']$/g, "")
          .replace(/^title:\s*/i, "")
          .trim()
          .slice(0, 60);

        if (title && title.length > 1) {
          setCurrentChatTitle(title);
        }
      } catch {
        // Silent fail — keep the existing title
      }
    },
    [token]
  );

  const stopGeneration = useCallback(() => {
    // Abort any in-flight SSE stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Finalize any streaming messages with whatever content was accumulated
    setMessages((prev) =>
      prev
        .filter((m) => !m.loading) // remove loading placeholders
        .map((m) =>
          m.isStreaming
            ? {
                ...m,
                isStreaming: false,
                content: m.content || "(Generation stopped)",
                detail: m.detail || "Stopped",
              }
            : m
        )
    );

    setSending(false);
  }, []);

  const sendPrompt = async () => {
    if (sending) return;

    const text = prompt.trim();
    if (!text) return;

    setSending(true);
    setPrompt("");

    const now = Date.now();

    const userMessage: UiMessage = {
      id: `user-${now}`,
      role: "user",
      content: text,
      timestamp: now,
    };

    const loadingId = `assistant-loading-${now}`;
    const loadingMessage: UiMessage = {
      id: loadingId,
      role: "assistant",
      content: "",
      loading: true,
      detail: bestAnswerMode ? BEST_ANSWER_LOADING[0] : loadingDetail,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);

    const shouldStore = Boolean(isAuthenticated && storeEnabled && token);
    const isFirstMessage = !currentChatTitle;

    try {
      if (bestAnswerMode) {
        // ── Best Answer Mode ──
        interface BestAnswerResponse {
          ok: boolean;
          final_answer: string;
          synthesized_by: string;
          agent_chat: AgentChatMessage[];
          response_time_seconds: number;
          chat_id?: string | null;
        }

        const response = await apiRequest<BestAnswerResponse>("/api/chat/best-answer", {
          method: "POST",
          token,
          body: {
            prompt: text,
            store: shouldStore,
            chat_id: shouldStore ? currentChatId : null,
            folder_id: shouldStore ? selectedFolderId : null,
          },
        });

        const assistantMessage: UiMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.final_answer,
          modelUsed: response.synthesized_by,
          detail: "Best Answer",
          animateTypewriter: true,
          timestamp: Date.now(),
          isBestAnswer: true,
          agentChat: response.agent_chat,
          synthesizedBy: response.synthesized_by,
          responseTimeSeconds: response.response_time_seconds,
        };

        setMessages((prev) => {
          const withoutLoader = prev.filter((item) => item.id !== loadingId);
          return [...withoutLoader, assistantMessage];
        });

        if (isFirstMessage) {
          setCurrentChatTitle(text.slice(0, 40) + (text.length > 40 ? "..." : ""));
          generateChatTitle(text, response.final_answer);
        }

        if (response.chat_id && token) {
          setCurrentChatId(response.chat_id);
          await loadChats(selectedFolderId);
        }
      } else {
        // ── Normal Mode (SSE streaming) ──
        const streamingId = `assistant-streaming-${now}`;
        const streamingMessage: UiMessage = {
          id: streamingId,
          role: "assistant",
          content: "",
          isStreaming: true,
          timestamp: Date.now(),
        };

        // Replace loading placeholder with streaming placeholder
        setMessages((prev) => {
          const withoutLoader = prev.filter((item) => item.id !== loadingId);
          return [...withoutLoader, streamingMessage];
        });

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // Create AbortController so the stream can be cancelled
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const res = await fetch("/api/proxy/api/chat/stream", {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            prompt: text,
            forced_model: preferredModel,
            store: shouldStore,
            chat_id: shouldStore ? currentChatId : null,
            folder_id: shouldStore ? selectedFolderId : null,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let streamModel = "";
        let streamDomain = "";
        let streamChatId: string | null = null;
        let accumulated = "";
        let streamError: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "stream_start") {
                streamModel = evt.model || "";
              } else if (evt.type === "token") {
                accumulated += evt.content || "";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamingId ? { ...m, content: accumulated } : m
                  )
                );
              } else if (evt.type === "stream_complete") {
                streamModel = evt.model || streamModel;
                streamDomain = evt.domain || "";
                streamChatId = evt.chat_id || null;
              } else if (evt.type === "stream_error") {
                streamError = evt.message || "Stream error";
              }
            } catch {
              // skip malformed JSON
            }
          }

          if (streamError) break;
        }

        // Process remaining buffer
        if (buffer.startsWith("data: ")) {
          try {
            const evt = JSON.parse(buffer.slice(6));
            if (evt.type === "stream_complete") {
              streamModel = evt.model || streamModel;
              streamDomain = evt.domain || "";
              streamChatId = evt.chat_id || null;
            } else if (evt.type === "stream_error") {
              streamError = evt.message || "Stream error";
            }
          } catch {
            // skip
          }
        }

        // Clear the abort controller now that the stream has finished
        abortControllerRef.current = null;

        if (streamError) {
          // Remove the streaming placeholder and show error
          setMessages((prev) => prev.filter((m) => m.id !== streamingId));
          throw new Error(streamError);
        }

        // Finalize: mark streaming complete with final metadata
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingId
              ? {
                  ...m,
                  content: accumulated,
                  isStreaming: false,
                  modelUsed: streamModel,
                  detail: streamDomain || "general",
                }
              : m
          )
        );

        if (isFirstMessage) {
          setCurrentChatTitle(text.slice(0, 40) + (text.length > 40 ? "..." : ""));
          generateChatTitle(text, accumulated);
        }

        if (streamChatId && token) {
          setCurrentChatId(streamChatId);
          await loadChats(selectedFolderId);
        }
      }
    } catch (error) {
      // If the user aborted the stream, stopGeneration() already cleaned up
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setMessages((prev) => prev.filter((item) => item.id !== loadingId && !item.isStreaming));
      showAlert(error instanceof Error ? error.message : "Failed to send prompt");
    } finally {
      abortControllerRef.current = null;
      setSending(false);
    }
  };

  const handleTaskSubmit = async (taskType: string, agents: Record<string, string>, taskPrompt: string) => {
    if (sending) return;

    setSending(true);

    const now = Date.now();

    const userMessage: UiMessage = {
      id: `user-${now}`,
      role: "user",
      content: taskPrompt,
      timestamp: now,
    };

    const loadingId = `assistant-loading-${now}`;
    const loadingMessage: UiMessage = {
      id: loadingId,
      role: "assistant",
      content: "",
      loading: true,
      detail: TASK_MODE_LOADING[0],
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);

    const shouldStore = Boolean(isAuthenticated && storeEnabled && token);
    const isFirstMessage = !currentChatTitle;

    try {
      interface TaskModeResponse {
        ok: boolean;
        final_answer: string;
        synthesized_by: string;
        task_type: string;
        workflow_chat: WorkflowStepMessage[];
        response_time_seconds: number;
        chat_id?: string | null;
      }

      const response = await apiRequest<TaskModeResponse>("/api/task-mode", {
        method: "POST",
        token,
        body: {
          task_prompt: taskPrompt,
          task_type: taskType,
          agents,
          store: shouldStore,
          chat_id: shouldStore ? currentChatId : null,
          folder_id: shouldStore ? selectedFolderId : null,
        },
      });

      const assistantMessage: UiMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.final_answer,
        modelUsed: response.synthesized_by,
        detail: "Task Mode",
        animateTypewriter: true,
        timestamp: Date.now(),
        isTaskMode: true,
        taskType: response.task_type,
        workflowChat: response.workflow_chat,
        responseTimeSeconds: response.response_time_seconds,
      };

      setMessages((prev) => {
        const withoutLoader = prev.filter((item) => item.id !== loadingId);
        return [...withoutLoader, assistantMessage];
      });

      if (isFirstMessage) {
        setCurrentChatTitle(taskPrompt.slice(0, 40) + (taskPrompt.length > 40 ? "..." : ""));
        generateChatTitle(taskPrompt, response.final_answer);
      }

      if (response.chat_id && token) {
        setCurrentChatId(response.chat_id);
        await loadChats(selectedFolderId);
      }
    } catch (error) {
      setMessages((prev) => prev.filter((item) => item.id !== loadingId));
      showAlert(error instanceof Error ? error.message : "Failed to run task workflow");
    } finally {
      setSending(false);
    }
  };

  const modelDisplayValue = preferredModel || "auto";

  return (
    <>
      <div className="flex h-full w-full gap-0 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden w-[260px] shrink-0 border-r border-[var(--border)] lg:block">
          <ChatSidebar
            user={user}
            loadingAuth={authLoading}
            folders={folders}
            chats={chats}
            selectedFolderId={selectedFolderId}
            currentChatId={currentChatId}
            folderName={folderName}
            onFolderNameChange={setFolderName}
            onCreateFolder={createFolder}
            onSelectFolder={(folderId) => {
              setSelectedFolderId(folderId);
              startNewChat();
            }}
            onSelectChat={selectChat}
            onStartNewChat={startNewChat}
            onOpenAuth={() => setAuthModalOpen(true)}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onDeleteChat={deleteChat}
            onRenameChat={renameChat}
          />
        </div>

        {/* Main chat area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Chat header with breadcrumb */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] px-3 sm:px-4">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-alt)] lg:hidden"
              >
                <PanelLeft size={16} />
              </button>

              {/* Breadcrumb */}
              <nav className="flex items-center gap-1 text-xs sm:text-sm min-w-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFolderId(null);
                    startNewChat();
                  }}
                  className="flex shrink-0 items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Home size={13} />
                  <span className="hidden sm:inline">Chats</span>
                </button>

                {selectedFolder && (
                  <>
                    <ChevronRight size={12} className="shrink-0 text-[var(--text-soft)]" />
                    <button
                      type="button"
                      onClick={() => startNewChat()}
                      className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors min-w-0"
                    >
                      <FolderOpen size={12} className="shrink-0" />
                      <span className="max-w-[80px] sm:max-w-[100px] truncate">{selectedFolder.name}</span>
                    </button>
                  </>
                )}

                {currentChatId && (
                  <>
                    <ChevronRight size={12} className="shrink-0 text-[var(--text-soft)]" />
                    <span className="truncate font-medium text-[var(--text-primary)] max-w-[100px] sm:max-w-[200px]">
                      {currentChatTitle || "Conversation"}
                    </span>
                  </>
                )}

                {!currentChatId && !selectedFolder && (
                  <>
                    <ChevronRight size={12} className="shrink-0 text-[var(--text-soft)]" />
                    <span className="font-medium text-[var(--text-primary)]">New Chat</span>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Model selector */}
              <div className="relative">
                <select
                  value={modelDisplayValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    const model = val === "auto" ? null : (val as Exclude<ModelName, null>);
                    setPreferredModelState(model);
                    setPreferredModel(model);
                  }}
                  className="h-7 appearance-none rounded-md border border-[var(--border)] bg-[var(--surface)] pl-2 pr-6 text-xs text-[var(--text-secondary)] outline-none hover:border-[var(--text-soft)]"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value ?? "auto"} value={opt.value ?? "auto"}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
              </div>

              <button
                type="button"
                onClick={startNewChat}
                className="flex h-7 items-center gap-1 rounded-md border border-[var(--border)] px-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">New</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <div className="mx-auto flex max-w-4xl flex-col gap-1 px-3 py-4 sm:px-6">
              {loadingChat ? (
                <>
                  <SkeletonMessage />
                  <SkeletonMessage />
                  <SkeletonMessage />
                </>
              ) : (
                messages.map((item) => (
                  <MessageBubble
                    key={item.id}
                    role={item.role}
                    content={item.content}
                    modelUsed={item.modelUsed}
                    detail={item.loading ? loadingDetail : item.detail}
                    loading={item.loading}
                    loadingNode={<LoaderDots />}
                    animateTypewriter={item.animateTypewriter}
                    showModelInfo={showModelInfo}
                    timestamp={item.timestamp}
                    isBestAnswer={item.isBestAnswer}
                    agentChat={item.agentChat}
                    synthesizedBy={item.synthesizedBy}
                    responseTimeSeconds={item.responseTimeSeconds}
                    isTaskMode={item.isTaskMode}
                    taskType={item.taskType}
                    workflowChat={item.workflowChat}
                  />
                ))
              )}
              <div ref={messageEndRef} />
            </div>
          </div>

          {/* Task Mode Panel — shown above composer when active */}
          {taskModeOpen && (
            <TaskModePanel
              onSubmit={handleTaskSubmit}
              onClose={() => setTaskModeOpen(false)}
              disabled={sending}
            />
          )}

          {/* Composer */}
          <ChatComposer
            value={prompt}
            onChange={setPrompt}
            onSend={sendPrompt}
            onStop={stopGeneration}
            disabled={sending}
            isGenerating={sending}
            bestAnswerMode={bestAnswerMode}
            taskModeOpen={taskModeOpen}
            onToggleBestAnswer={setBestAnswerMode}
            onToggleTaskMode={() => setTaskModeOpen((prev) => !prev)}
          />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 z-[90] lg:hidden ${
          mobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileSidebarOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            mobileSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <div
          className={`absolute left-0 top-0 h-full w-[280px] border-r border-[var(--border)] bg-[var(--background)] transition-transform duration-200 ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <ChatSidebar
            user={user}
            loadingAuth={authLoading}
            folders={folders}
            chats={chats}
            selectedFolderId={selectedFolderId}
            currentChatId={currentChatId}
            folderName={folderName}
            showNavLinks
            onFolderNameChange={setFolderName}
            onCreateFolder={createFolder}
            onSelectFolder={(folderId) => {
              setSelectedFolderId(folderId);
              startNewChat();
            }}
            onSelectChat={selectChat}
            onStartNewChat={startNewChat}
            onOpenAuth={() => {
              setMobileSidebarOpen(false);
              setAuthModalOpen(true);
            }}
            onNavigate={() => setMobileSidebarOpen(false)}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            onDeleteChat={deleteChat}
            onRenameChat={renameChat}
          />
        </div>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="animate-fade-in w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{confirmModal.title}</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{confirmModal.message}</p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-alt)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { ChatWorkspace };
export default ChatWorkspace;
