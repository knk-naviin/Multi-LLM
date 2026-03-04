"use client";

import Link from "next/link";
import { FolderOpen, LogIn, Plus, MessageSquare } from "lucide-react";

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
}: ChatSidebarProps) {
  return (
    <aside className="flex h-full flex-col overflow-hidden bg-[var(--surface)] p-3">
      {/* New Chat button */}
      <button
        type="button"
        onClick={() => { onStartNewChat(); onNavigate?.(); }}
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
          <Link
            href="/settings"
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]"
            onClick={onNavigate}
          >
            Settings
          </Link>
        </div>
      )}

      {/* Folders */}
      <div className="mb-1">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-soft)]">Folders</span>
        </div>

        <div className="mb-2 flex gap-1.5">
          <input
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-soft)] focus:border-[var(--text-soft)]"
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

        <div className="custom-scrollbar grid max-h-[140px] gap-0.5 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onSelectFolder(null); onNavigate?.(); }}
            className={`rounded-md px-2 py-1.5 text-left text-xs transition ${
              selectedFolderId === null
                ? "bg-[var(--surface-alt)] font-medium text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            All Chats
          </button>

          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => { onSelectFolder(folder.id); onNavigate?.(); }}
              title={folder.description}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition ${
                selectedFolderId === folder.id
                  ? "bg-[var(--surface-alt)] font-medium text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              <FolderOpen size={12} />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}

          {!folders.length && (
            <p className="px-2 py-1 text-[11px] text-[var(--text-soft)]">No folders yet.</p>
          )}
        </div>
      </div>

      {/* Recent Chats */}
      <div className="mb-1 mt-2 px-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-soft)]">Recent</span>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-0.5">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => { onSelectChat(chat.id); onNavigate?.(); }}
              className={`grid gap-0.5 rounded-md px-2 py-1.5 text-left transition ${
                currentChatId === chat.id
                  ? "bg-[var(--surface-alt)]"
                  : "hover:bg-[var(--surface-alt)]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare size={11} className="shrink-0 text-[var(--text-soft)]" />
                <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                  {chat.title || "Untitled"}
                </span>
              </span>
              <span className="truncate pl-[18px] text-[10px] text-[var(--text-soft)]">
                {chat.last_model || ""} {chat.last_message ? `· ${chat.last_message}` : ""}
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
          <p className="text-xs text-[var(--text-soft)]">Checking session...</p>
        ) : user ? (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-white">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{user.name}</p>
              <p className="truncate text-[10px] text-[var(--text-soft)]">{user.email}</p>
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
