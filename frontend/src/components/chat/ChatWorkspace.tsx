"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, PanelLeft } from "lucide-react";

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
  content: `## Welcome to ${APP_NAME}\n\nGuest mode is active. Sign in to unlock folders, persistent chat history, and workspace settings.`,
  modelUsed: "benchmarkModel",
  detail: `SaaS workspace · ${CLIENT_ROUTER_KEY}`,
};

function shouldAnimateTypewriter(text: string): boolean {
  const compact = text.trim();
  if (!compact || compact.includes("\n")) {
    return false;
  }

  if (/(\*\*|__|`|^\#{1,6}\s|\[[^\]]+\]\([^)]+\))/m.test(compact)) {
    return false;
  }

  if (compact.length > 220) {
    return false;
  }

  const sentenceEnders = (compact.match(/[.!?]/g) || []).length;
  return sentenceEnders <= 1;
}

function messageFromThread(message: ChatThread["messages"][number], index: number): UiMessage {
  return {
    id: `thread-${index}-${message.created_at || index}`,
    role: message.role,
    content: message.content,
    modelUsed: message.model_used,
    detail: message.role === "assistant" ? "Stored message" : undefined,
    animateTypewriter: false,
  };
}

function safeTitle(text: string): string {
  const compact = text.trim().replace(/\s+/g, " ");
  if (!compact) {
    return "Conversation";
  }
  return compact.length > 60 ? `${compact.slice(0, 60)}...` : compact;
}

type SidebarEvent = CustomEvent<{ open?: boolean }>;

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
        if (!currentChatId) {
          return prev;
        }
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
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
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

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) || null,
    [folders, selectedFolderId]
  );

  const activeChatSummary = useMemo(
    () => chats.find((chat) => chat.id === currentChatId) || null,
    [chats, currentChatId]
  );

  const activeFolderFromChat = useMemo(() => {
    const chatFolderId = activeChatSummary?.folder_id || activeChatSummary?.project_id;
    if (!chatFolderId) {
      return null;
    }
    return folders.find((folder) => folder.id === chatFolderId) || null;
  }, [activeChatSummary, folders]);

  const breadcrumbFolder = selectedFolder || activeFolderFromChat;
  const breadcrumbChatTitle = currentChatTitle || activeChatSummary?.title || null;

  const selectChat = async (chatId: string) => {
    if (!token) {
      return;
    }

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
    if (sending) {
      return;
    }

    const text = prompt.trim();
    if (!text) {
      return;
    }

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
      detail: "benchmarkModel selecting best model",
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
          ? ` · Fallback: ${response.fallback_errors[0]}`
          : "";

      const assistantMessage: UiMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response,
        modelUsed: response.model_selected,
        detail: `Domain: ${response.domain || "general"} · Selector: ${response.selector}${fallback}`,
        animateTypewriter: shouldAnimateTypewriter(response.response),
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

  return (
    <>
      <div className="mx-auto mt-3 grid h-[calc(100dvh-150px)] min-h-0 w-full max-w-[1540px] grid-cols-1 gap-4 px-3 pb-4 lg:h-[calc(100dvh-140px)] lg:grid-cols-[320px_minmax(0,1fr)] lg:px-4">
        <div className="hidden h-full min-h-0 lg:block">
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

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] shadow-sm">
          <header className="shrink-0 border-b border-[var(--stroke)] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-[var(--text-main)] sm:text-xl">
                  {currentChatId ? currentChatTitle || "Conversation" : "New Chat"}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startNewChat}
                  className="rounded-lg border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-alt)]"
                >
                  New Chat
                </button>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--stroke)] bg-[var(--surface-alt)] px-3 py-1.5 text-xs font-semibold text-[var(--text-main)] lg:hidden"
                >
                  <PanelLeft size={14} />
                  Menu
                </button>
              </div>
            </div>

            {breadcrumbFolder || breadcrumbChatTitle ? (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-[var(--text-soft)]">
                <span>Workspace</span>
                {breadcrumbFolder ? (
                  <>
                    <ChevronRight size={12} />
                    <span className="rounded bg-[var(--surface-alt)] px-2 py-0.5 text-[var(--text-main)]">
                      {breadcrumbFolder.name}
                    </span>
                  </>
                ) : null}
                {breadcrumbChatTitle ? (
                  <>
                    <ChevronRight size={12} />
                    <span className="rounded bg-[var(--surface-alt)] px-2 py-0.5 text-[var(--text-main)]">
                      {breadcrumbChatTitle}
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}
          </header>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
            <div className="flex min-h-full flex-col gap-3">
            {messages.map((item) => (
              <MessageBubble
                key={item.id}
                role={item.role}
                content={item.content}
                modelUsed={item.modelUsed}
                detail={item.detail}
                loading={item.loading}
                loadingNode={<LoaderDots label={`${APP_NAME} is typing a thoughtful answer`} />}
                animateTypewriter={item.animateTypewriter}
              />
            ))}
            <div ref={messageEndRef} />
            </div>
          </div>

          <ChatComposer value={prompt} onChange={setPrompt} onSend={sendPrompt} disabled={sending} />
        </section>
      </div>

      <div
        className={`fixed inset-0 z-[90] lg:hidden ${
          mobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileSidebarOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity ${
            mobileSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <div
          className={`absolute left-0 top-0 h-full w-[88%] max-w-[360px] p-3 transition-transform duration-200 ${
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
