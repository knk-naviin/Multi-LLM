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
} from "lucide-react";

import type { ChatSummary, Folder, User } from "@/lib/types";

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
}

function FolderMenu({
  folderId,
  folderNameValue,
  onRename,
  onDelete,
}: {
  folderId: string;
  folderNameValue: string;
  onRename?: (folderId: string, newName: string) => void;
  onDelete?: (folderId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renamingValue, setRenamingValue] = useState(folderNameValue);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleRenameSubmit = () => {
    const trimmed = renamingValue.trim();
    if (trimmed.length >= 2 && trimmed !== folderNameValue) {
      onRename?.(folderId, trimmed);
    }
    setRenaming(false);
    setMenuOpen(false);
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-1 ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={renamingValue}
          onChange={(e) => setRenamingValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleRenameSubmit();
            }
            if (e.key === "Escape") {
              setRenaming(false);
              setRenamingValue(folderNameValue);
            }
          }}
          className="w-20 rounded border border-[var(--brand)] bg-[var(--background)] px-1.5 py-0.5 text-[11px] text-[var(--text-primary)] outline-none"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRenameSubmit();
          }}
          className="rounded p-0.5 text-emerald-500 hover:bg-[var(--surface-hover)]"
        >
          <Check size={11} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRenaming(false);
            setRenamingValue(folderNameValue);
          }}
          className="rounded p-0.5 text-[var(--text-soft)] hover:bg-[var(--surface-hover)]"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
        }}
        className="rounded p-0.5 text-[var(--text-soft)] opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-opacity"
      >
        <MoreVertical size={12} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-28 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRenamingValue(folderNameValue);
              setRenaming(true);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] transition"
          >
            <Pencil size={11} />
            Rename
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(folderId);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-500/5 transition"
          >
            <Trash2 size={11} />
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
}) {
  const [expanded, setExpanded] = useState(isSelected);
  const folderChats = chats.filter(
    (c) => c.folder_id === folder.id || c.project_id === folder.id
  );

  return (
    <div className="animate-slide-in group">
      <div
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition cursor-pointer ${
          isSelected
            ? "bg-[var(--surface-alt)] font-medium text-[var(--text-primary)]"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
        }`}
      >
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

        <FolderMenu
          folderId={folder.id}
          folderNameValue={folder.name}
          onRename={onRenameFolder}
          onDelete={onDeleteFolder}
        />
      </div>

      {expanded && folderChats.length > 0 && (
        <div className="ml-3 border-l border-[var(--border)] pl-2 mt-0.5">
          {folderChats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => {
                onSelectChat(chat.id);
                onNavigate?.();
              }}
              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition ${
                currentChatId === chat.id
                  ? "bg-[var(--brand-subtle)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              <MessageSquare size={10} className="shrink-0 text-[var(--text-soft)]" />
              <span className="truncate">{chat.title || "Untitled"}</span>
            </button>
          ))}
        </div>
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
}: ChatSidebarProps) {
  const isSignedIn = Boolean(user);

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-[var(--surface)] p-3">
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
        <div className="mb-3 grid gap-0.5">
          <Link
            href="/chat"
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]"
            onClick={onNavigate}
          >
            Chat
          </Link>
          <Link
            href="/about"
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]"
            onClick={onNavigate}
          >
            About
          </Link>
          {isSignedIn && (
            <Link
              href="/settings"
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]"
              onClick={onNavigate}
            >
              Settings
            </Link>
          )}
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
              className="rounded-md bg-[var(--brand)] px-2 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-hover)]"
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
            <button
              key={chat.id}
              type="button"
              onClick={() => {
                onSelectChat(chat.id);
                onNavigate?.();
              }}
              className={`grid gap-0.5 rounded-md px-2 py-1.5 text-left transition ${
                currentChatId === chat.id
                  ? "bg-[var(--surface-alt)]"
                  : "hover:bg-[var(--surface-alt)]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare
                  size={11}
                  className="shrink-0 text-[var(--text-soft)]"
                />
                <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                  {chat.title || "Untitled"}
                </span>
              </span>
              <span className="truncate pl-[18px] text-[10px] text-[var(--text-soft)]">
                {chat.last_model || ""}{" "}
                {chat.last_message ? `· ${chat.last_message}` : ""}
              </span>
            </button>
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
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-white">
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
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--brand-hover)]"
          >
            <LogIn size={14} />
            Sign In
          </button>
        )}
      </div>
    </aside>
  );
}
