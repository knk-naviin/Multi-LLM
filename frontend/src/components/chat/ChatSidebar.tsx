"use client";

import Link from "next/link";
import { FolderOpen, LogIn, MessageSquarePlus } from "lucide-react";

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
    <aside className="grid h-full gap-3 overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3">
      {showNavLinks ? (
        <section className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-alt)]/60 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Navigation</p>
          <div className="grid gap-1 text-sm">
            <Link
              href="/chat"
              className="rounded-lg px-2.5 py-2 text-[var(--text-main)] hover:bg-[var(--surface)]"
              onClick={onNavigate}
            >
              Chat
            </Link>
            <Link
              href="/about"
              className="rounded-lg px-2.5 py-2 text-[var(--text-main)] hover:bg-[var(--surface)]"
              onClick={onNavigate}
            >
              About
            </Link>
            <Link
              href="/settings"
              className="rounded-lg px-2.5 py-2 text-[var(--text-main)] hover:bg-[var(--surface)]"
              onClick={onNavigate}
            >
              Settings
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-alt)]/60 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Account</p>
        {loadingAuth ? <p className="text-xs text-[var(--text-soft)]">Checking session...</p> : null}

        {user ? (
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">{user.name}</h3>
            <p className="text-xs text-[var(--text-soft)]">{user.email}</p>
          </div>
        ) : (
          <div className="grid gap-2">
            <h3 className="text-base font-bold text-[var(--text-main)]">Guest Mode</h3>
            <p className="text-xs text-[var(--text-soft)]">Sign in to store chats inside folders.</p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
            >
              <LogIn size={14} />
              Sign In
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-alt)]/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Folders</p>
          <button
            type="button"
            onClick={onStartNewChat}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--stroke)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-main)]"
          >
            <MessageSquarePlus size={12} />
            New
          </button>
        </div>

        <div className="mb-2 flex gap-2">
          <input
            className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-2.5 py-2 text-sm text-[var(--text-main)] outline-none"
            value={folderName}
            placeholder="New folder"
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
            className="rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
          >
            Add
          </button>
        </div>

        <div className="grid max-h-[170px] gap-1 overflow-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => {
              onSelectFolder(null);
              onNavigate?.();
            }}
            className={`rounded-lg border px-2.5 py-2 text-left text-sm ${
              selectedFolderId === null
                ? "border-[var(--stroke)] bg-[var(--surface)] text-[var(--text-main)]"
                : "border-transparent text-[var(--text-soft)] hover:border-[var(--stroke)]"
            }`}
          >
            All Folders
          </button>

          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => {
                onSelectFolder(folder.id);
                onNavigate?.();
              }}
              title={folder.description}
              className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm ${
                selectedFolderId === folder.id
                  ? "border-[var(--stroke)] bg-[var(--surface)] text-[var(--text-main)]"
                  : "border-transparent text-[var(--text-soft)] hover:border-[var(--stroke)]"
              }`}
            >
              <FolderOpen size={14} />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}

          {!folders.length ? <p className="text-xs text-[var(--text-soft)]">No folders yet.</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-alt)]/60 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Recent Chats</p>

        <div className="grid max-h-[32vh] gap-1 overflow-auto custom-scrollbar">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => {
                onSelectChat(chat.id);
                onNavigate?.();
              }}
              className={`grid gap-0.5 rounded-lg border px-2.5 py-2 text-left ${
                currentChatId === chat.id
                  ? "border-[var(--stroke)] bg-[var(--surface)]"
                  : "border-transparent hover:border-[var(--stroke)]"
              }`}
            >
              <span className="truncate text-sm font-semibold text-[var(--text-main)]">{chat.title || "Untitled"}</span>
              <span className="truncate text-[11px] text-[var(--text-soft)]">
                {chat.last_model || "-"} · {chat.last_message || "..."}
              </span>
            </button>
          ))}

          {!chats.length ? (
            <p className="text-xs text-[var(--text-soft)]">
              {user ? "No saved chats yet." : "Sign in to store chats."}
            </p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
