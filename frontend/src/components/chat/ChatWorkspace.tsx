"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft, Plus, ChevronDown } from "lucide-react";

import { AuthModal } from "@/components/auth/AuthModal";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { LoaderDots } from "@/components/common/LoaderDots";
import { useAlerts } from "@/contexts/AlertContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/api";
import { APP_NAME, CLIENT_ROUTER_KEY } from "@/lib/constants";
import { getAutoStore, getPreferredModel, setAutoStore, setPreferredModel } from "@/lib/preferences";
import type {
  ChatCompletionResponse,
  ChatSummary,
  ChatThread,
  Folder,
  ModelName,
  UiMessage,
} from "@/lib/types";

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
  };
}

function safeTitle(text: string): string {
  const compact = text.trim().replace(/\s+/g, " ");
  if (!compact) return "Conversation";
  return compact.length > 60 ? `${compact.slice(0, 60)}...` : compact;
}

type SidebarEvent = CustomEvent<{ open?: boolean }>;

const MODEL_OPTIONS: { value: ModelName | "auto"; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "gpt", label: "GPT" },
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
];

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const messageEndRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setStoreEnabled(getAutoStore());
    setPreferredModelState(getPreferredModel());

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "1" || params.get("authRequired") === "1") {
      setAuthModalOpen(true);
    }
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
          };
        }>("/api/settings", { token }),
      ]);

      setFolders(folderRes.folders);

      const pref = settingsRes.settings?.preferred_model ?? getPreferredModel();
      const autoStore = settingsRes.settings?.auto_store_chats ?? getAutoStore();
      setPreferredModelState(pref || null);
      setStoreEnabled(Boolean(autoStore));
      setPreferredModel(pref || null);
      setAutoStore(Boolean(autoStore));
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

  const selectChat = async (chatId: string) => {
    if (!token) return;

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

  const startNewChat = () => {
    setCurrentChatId(null);
    setCurrentChatTitle(null);
    setMessages([welcomeMessage]);
  };

  const sendPrompt = async () => {
    if (sending) return;

    const text = prompt.trim();
    if (!text) return;

    setSending(true);
    setPrompt("");

    const userMessage: UiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    const loadingId = `assistant-loading-${Date.now()}`;
    const loadingMessage: UiMessage = {
      id: loadingId,
      role: "assistant",
      content: "",
      loading: true,
      detail: "Selecting best model...",
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);

    const shouldStore = Boolean(isAuthenticated && storeEnabled && token);

    try {
      const response = await apiRequest<ChatCompletionResponse>("/api/chat/complete", {
        method: "POST",
        token,
        body: {
          prompt: text,
          forced_model: preferredModel,
          store: shouldStore,
          chat_id: shouldStore ? currentChatId : null,
          folder_id: shouldStore ? selectedFolderId : null,
        },
      });

      const fallback =
        response.fallback_errors && response.fallback_errors.length
          ? ` | Fallback: ${response.fallback_errors[0]}`
          : "";

      const assistantMessage: UiMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response,
        modelUsed: response.model_selected,
        detail: `${response.domain || "general"}${fallback}`,
        animateTypewriter: false,
      };

      setMessages((prev) => {
        const withoutLoader = prev.filter((item) => item.id !== loadingId);
        return [...withoutLoader, assistantMessage];
      });

      if (!currentChatTitle) {
        setCurrentChatTitle(safeTitle(text));
      }

      if (response.chat_id && token) {
        setCurrentChatId(response.chat_id);
        await loadChats(selectedFolderId);
      }
    } catch (error) {
      setMessages((prev) => prev.filter((item) => item.id !== loadingId));
      showAlert(error instanceof Error ? error.message : "Failed to send prompt");
    } finally {
      setSending(false);
    }
  };

  const modelDisplayValue = preferredModel || "auto";

  return (
    <>
      <div className="mx-auto flex h-[calc(100dvh-49px)] w-full max-w-6xl gap-0 lg:gap-0">
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
          />
        </div>

        {/* Main chat area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Chat header */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-alt)] lg:hidden"
              >
                <PanelLeft size={16} />
              </button>
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                {currentChatId ? currentChatTitle || "Conversation" : "New Chat"}
              </span>
            </div>

            <div className="flex items-center gap-2">
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
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-4">
              {messages.map((item) => (
                <MessageBubble
                  key={item.id}
                  role={item.role}
                  content={item.content}
                  modelUsed={item.modelUsed}
                  detail={item.detail}
                  loading={item.loading}
                  loadingNode={<LoaderDots />}
                  animateTypewriter={item.animateTypewriter}
                />
              ))}
              <div ref={messageEndRef} />
            </div>
          </div>

          {/* Composer */}
          <ChatComposer value={prompt} onChange={setPrompt} onSend={sendPrompt} disabled={sending} />
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
          />
        </div>
      </div>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}

export { ChatWorkspace };
export default ChatWorkspace;
