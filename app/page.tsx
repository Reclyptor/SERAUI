"use client";

import { Sidebar } from "./components/Sidebar";
import { SeraChat } from "./components/SeraChat";
import { useChat } from "./contexts/ChatContext";

export default function Home() {
  const { currentChatID, currentMessages, recentChats, newChat, selectChat } = useChat();

  // Transform recentChats to match Sidebar's expected format
  const sidebarChats = recentChats.map((chat) => ({
    id: chat._id,
    title: chat.title,
  }));

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar
        recentChats={sidebarChats}
        onNewChat={newChat}
        onSelectChat={selectChat}
        currentChatID={currentChatID}
      />
      <main className="flex-1 flex flex-col min-w-0 lg:ml-0 ml-[48px]">
        <SeraChat chatID={currentChatID} initialMessages={currentMessages} />
      </main>
    </div>
  );
}
