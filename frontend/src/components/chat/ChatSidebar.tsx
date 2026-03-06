"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  LogIn,
  Plus,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Check,
  LayoutDashboard,
  Users,
  Sparkles,
  Layers,
  Settings,
} from "lucide-react";

import type { ChatSummary, Folder, User } from "@/lib/types";
import { BRAND_GRADIENT } from "@/lib/brand";

interface ChatSidebarProps {
  user: User | null;
  loadingAuth: boolean;
  folders: Folder[];
  chats: ChatSummary[];
  selectedFolderId: string | null;
  currentChatId: string | null;
  folderName: string;
  showNavLinks?: boolean;
  onFolderNameChange: (value: string) => void;
  onCreateFolder: () => void;
  onSelectFolder: (folderId: string | null) => void;
  onSelectChat: (chatId: string) => void;
  onStartNewChat: () => void;
  onOpenAuth: () => void;
  onNavigate?: () => void;
  onRenameFolder?: (folderId: string, newName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onDeleteChat?: (chatId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
}

/* ─── Three-dot dropdown menu for folders & chats ─── */
function ItemMenu({
  onRenameClick,
  onDeleteClick,
}: {
  onRenameClick: () => void;
  onDeleteClick: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 72; // approx height of 2 menu items

      setDropdownStyle({
        position: "fixed",
        right: window.innerWidth - rect.right,
        ...(spaceBelow < dropdownHeight
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        zIndex: 200,
      });
    }
    setMenuOpen((prev) => !prev);
  };

  return (
    <div ref={menuRef} className="relative ml-auto shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={openMenu}
        className="rounded p-1 text-[var(--text-soft)] sm:opacity-0 sm:group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-opacity"
      >
        <MoreVertical size={13} />
      </button>

      {menuOpen && (
        <div
          style={dropdownStyle}
          className="w-32 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRenameClick();
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-alt)] transition"
          >
            <Pencil size={12} />
            Rename
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick();
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/5 transition"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function FolderTreeItem({
  folder,
  chats,
  isSelected,
  currentChatId,
  onSelectFolder,
  onSelectChat,
  onNavigate,
  onRenameFolder,
  onDeleteFolder,
  onDeleteChat,
  onRenameChat,
}: {
  folder: Folder;
  chats: ChatSummary[];
  isSelected: boolean;
  currentChatId: string | null;
  onSelectFolder: (folderId: string) => void;
  onSelectChat: (chatId: string) => void;
  onNavigate?: () => void;
  onRenameFolder?: (folderId: string, newName: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onDeleteChat?: (chatId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
}) {
  const [expanded, setExpanded] = useState(isSelected);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [chatRenameValue, setChatRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const folderChats = chats.filter(
    (c) => c.folder_id === folder.id || c.project_id === folder.id
  );

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (renamingChatId && chatInputRef.current) {
      chatInputRef.current.focus();
      chatInputRef.current.select();
    }
  }, [renamingChatId]);

  const handleFolderRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed.length >= 2 && trimmed !== folder.name) {
      onRenameFolder?.(folder.id, trimmed);
    }
    setRenaming(false);
  };

  const handleChatRenameSubmit = (chatId: string) => {
    const trimmed = chatRenameValue.trim();
    if (trimmed.length >= 1) {
      onRenameChat?.(chatId, trimmed);
    }
    setRenamingChatId(null);
  };

  return (
    <div className="animate-slide-in group/folder">
      <div
        className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition cursor-pointer ${
          isSelected
            ? "bg-[var(--surface-alt)] font-medium text-[var(--text-primary)]"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
        }`}
      >
        {renaming ? (
          /* Rename mode — full-width input row */
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <FolderOpen size={12} className="shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleFolderRenameSubmit();
                }
                if (e.key === "Escape") {
                  setRenaming(false);
                  setRenameValue(folder.name);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-[var(--brand)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleFolderRenameSubmit();
              }}
              className="shrink-0 rounded p-1 text-emerald-500 hover:bg-[var(--surface-hover)]"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRenaming(false);
                setRenameValue(folder.name);
              }}
              className="shrink-0 rounded p-1 text-[var(--text-soft)] hover:bg-[var(--surface-hover)]"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          /* Normal mode — folder name + expand/collapse */
          <>
            <button
              type="button"
              onClick={() => {
                setExpanded((prev) => !prev);
                onSelectFolder(folder.id);
                onNavigate?.();
              }}
              className="flex flex-1 items-center gap-1.5 min-w-0"
              title={folder.description}
            >
              {folderChats.length > 0 ? (
                expanded ? (
                  <ChevronDown size={12} className="shrink-0 text-[var(--text-soft)]" />
                ) : (
                  <ChevronRight size={12} className="shrink-0 text-[var(--text-soft)]" />
                )
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <FolderOpen size={12} className="shrink-0" />
              <span className="truncate">{folder.name}</span>
              {folderChats.length > 0 && (
                <span className="text-[10px] text-[var(--text-soft)]">{folderChats.length}</span>
              )}
            </button>
            <ItemMenu
              onRenameClick={() => {
                setRenameValue(folder.name);
                setRenaming(true);
              }}
              onDeleteClick={() => onDeleteFolder?.(folder.id)}
            />
          </>
        )}
      </div>

      {expanded && folderChats.length > 0 && (
        <div className="ml-3 border-l border-[var(--border)] pl-2 mt-0.5">
          {folderChats.map((chat) => (
            <div key={chat.id} className="group flex items-center">
              {renamingChatId === chat.id ? (
                <div className="flex items-center gap-1.5 w-full px-2 py-1" onClick={(e) => e.stopPropagation()}>
                  <MessageSquare size={10} className="shrink-0 text-[var(--text-soft)]" />
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatRenameValue}
                    onChange={(e) => setChatRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleChatRenameSubmit(chat.id);
                      }
                      if (e.key === "Escape") {
                        setRenamingChatId(null);
                      }
                    }}
                    className="min-w-0 flex-1 rounded border border-[var(--brand)] bg-[var(--background)] px-2 py-1 text-[11px] text-[var(--text-primary)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleChatRenameSubmit(chat.id)}
                    className="shrink-0 rounded p-1 text-emerald-500 hover:bg-[var(--surface-hover)]"
                  >
                    <Check size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingChatId(null)}
                    className="shrink-0 rounded p-1 text-[var(--text-soft)] hover:bg-[var(--surface-hover)]"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectChat(chat.id);
                      onNavigate?.();
                    }}
                    className={`flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition min-w-0 ${
                      currentChatId === chat.id
                        ? "bg-[var(--brand-subtle)] text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    <MessageSquare size={10} className="shrink-0 text-[var(--text-soft)]" />
                    <span className="truncate">{chat.title || "Untitled"}</span>
                  </button>
                  <ItemMenu
                    onRenameClick={() => {
                      setChatRenameValue(chat.title || "");
                      setRenamingChatId(chat.id);
                    }}
                    onDeleteClick={() => onDeleteChat?.(chat.id)}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentChatItem({
  chat,
  isActive,
  isSignedIn,
  onSelectChat,
  onNavigate,
  onRenameChat,
  onDeleteChat,
}: {
  chat: ChatSummary;
  isActive: boolean;
  isSignedIn: boolean;
  onSelectChat: (chatId: string) => void;
  onNavigate?: () => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onDeleteChat?: (chatId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(chat.title || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleSubmit = () => {
    const trimmed = renameVal.trim();
    if (trimmed.length >= 1) onRenameChat?.(chat.id, trimmed);
    setRenaming(false);
  };

  return (
    <div
      className={`group flex items-center rounded-md px-2 py-1.5 text-left transition ${
        isActive ? "bg-[var(--surface-alt)]" : "hover:bg-[var(--surface-alt)]"
      }`}
    >
      {renaming ? (
        <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
          <MessageSquare size={11} className="shrink-0 text-[var(--text-soft)]" />
          <input
            ref={inputRef}
            type="text"
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape") setRenaming(false);
            }}
            className="min-w-0 flex-1 rounded border border-[var(--brand)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="shrink-0 rounded p-1 text-emerald-500 hover:bg-[var(--surface-hover)]"
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            onClick={() => setRenaming(false)}
            className="shrink-0 rounded p-1 text-[var(--text-soft)] hover:bg-[var(--surface-hover)]"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              onSelectChat(chat.id);
              onNavigate?.();
            }}
            className="flex-1 min-w-0 grid gap-0.5 text-left"
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare size={11} className="shrink-0 text-[var(--text-soft)]" />
              <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                {chat.title || "Untitled"}
              </span>
            </span>
            <span className="truncate pl-[18px] text-[10px] text-[var(--text-soft)]">
              {chat.last_model || ""}{" "}
              {chat.last_message ? `· ${chat.last_message}` : ""}
            </span>
          </button>
          {isSignedIn && (
            <ItemMenu
              onRenameClick={() => {
                setRenameVal(chat.title || "");
                setRenaming(true);
              }}
              onDeleteClick={() => onDeleteChat?.(chat.id)}
            />
          )}
        </>
      )}
    </div>
  );
}

export function ChatSidebar({
  user,
  loadingAuth,
  folders,
  chats,
  selectedFolderId,
  currentChatId,
  folderName,
  showNavLinks = false,
  onFolderNameChange,
  onCreateFolder,
  onSelectFolder,
  onSelectChat,
  onStartNewChat,
  onOpenAuth,
  onNavigate,
  onRenameFolder,
  onDeleteFolder,
  onDeleteChat,
  onRenameChat,
}: ChatSidebarProps) {
  const isSignedIn = Boolean(user);

  return (
    <aside className="flex h-full flex-col bg-[var(--surface)] p-3">
      {/* New Chat button */}
      <button
        type="button"
        onClick={() => {
          onStartNewChat();
          onNavigate?.();
        }}
        className="mb-3 flex w-full items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-alt)]"
      >
        <Plus size={14} />
        New Chat
      </button>

      {showNavLinks && (
        <div className="mb-3 border-b border-[var(--border)] pb-3 grid gap-0.5">
          {[
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/chat", label: "Chat", icon: MessageSquare },
            { href: "/council", label: "AI Council", icon: Users },
            { href: "/custom-swastik", label: "Custom Swastik", icon: Sparkles },
            { href: "/task-mode", label: "Task Mode", icon: Layers },
            ...(isSignedIn ? [{ href: "/settings", label: "Settings", icon: Settings }] : []),
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)] transition"
                onClick={onNavigate}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Folders — only show when signed in */}
      {isSignedIn && (
        <div className="mb-1">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-soft)]">
              Folders
            </span>
          </div>

          <div className="mb-2 flex gap-1.5">
            <input
              className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)] focus:border-[var(--brand)] transition-colors"
              value={folderName}
              placeholder="New folder..."
              onChange={(event) => onFolderNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onCreateFolder();
                }
              }}
            />
            <button
              type="button"
              onClick={onCreateFolder}
              className="brand-gradient rounded-md px-2 py-1.5 text-xs font-medium text-white transition"
            >
              Add
            </button>
          </div>

          <div className="custom-scrollbar grid max-h-[200px] gap-0.5 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onSelectFolder(null);
                onNavigate?.();
              }}
              className={`rounded-md px-2 py-1.5 text-left text-xs transition ${
                selectedFolderId === null
                  ? "bg-[var(--surface-alt)] font-medium text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              All Chats
            </button>

            {folders.map((folder) => (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                chats={chats}
                isSelected={selectedFolderId === folder.id}
                currentChatId={currentChatId}
                onSelectFolder={onSelectFolder}
                onSelectChat={onSelectChat}
                onNavigate={onNavigate}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onDeleteChat={onDeleteChat}
                onRenameChat={onRenameChat}
              />
            ))}

            {!folders.length && (
              <p className="px-2 py-1 text-[11px] text-[var(--text-soft)]">
                No folders yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent Chats */}
      <div className="mb-1 mt-2 px-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-soft)]">
          Recent
        </span>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-0.5">
          {chats.map((chat) => (
            <RecentChatItem
              key={chat.id}
              chat={chat}
              isActive={currentChatId === chat.id}
              isSignedIn={isSignedIn}
              onSelectChat={onSelectChat}
              onNavigate={onNavigate}
              onRenameChat={onRenameChat}
              onDeleteChat={onDeleteChat}
            />
          ))}

          {!chats.length && (
            <p className="px-2 py-1 text-[11px] text-[var(--text-soft)]">
              {user ? "No saved chats yet." : "Sign in to store chats."}
            </p>
          )}
        </div>
      </div>

      {/* Account section at bottom */}
      <div className="mt-auto shrink-0 border-t border-[var(--border)] pt-3">
        {loadingAuth ? (
          <div className="flex items-center gap-2">
            <div className="skeleton h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-2 w-28" />
            </div>
          </div>
        ) : user ? (
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: BRAND_GRADIENT }}
            >
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                {user.name}
              </p>
              <p className="truncate text-[10px] text-[var(--text-soft)]">
                {user.email}
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="brand-gradient flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition"
          >
            <LogIn size={14} />
            Sign In
          </button>
        )}
      </div>
    </aside>
  );
}
