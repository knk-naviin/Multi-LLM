"use client";

import dynamic from "next/dynamic";

const ChatWorkspace = dynamic(
  () =>
    import("@/components/chat/ChatWorkspace").then(
      (mod) => mod.ChatWorkspace
    ),
  { ssr: false }
);

export default function ChatPage() {
  return (
    <div className="h-full min-h-0 w-full">
      <ChatWorkspace />
    </div>
  );
}
