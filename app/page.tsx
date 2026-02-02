"use client";

import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatContainer } from "./components/ChatContainer";
import { useChat } from "./contexts/ChatContext";
import { useAuth } from "./providers/CopilotKitProvider";

export default function Home() {
  const { currentChatID, currentMessages, recentChats, newChat, selectChat } = useChat();
  const { accessToken, runtimeUrl } = useAuth();
  const [chatKey, setChatKey] = useState(0);

  const handleNewChat = () => {
    setChatKey((k) => k + 1);
    newChat();
  };

  const handleSelectChat = async (chatID: string) => {
    setChatKey((k) => k + 1);
    await selectChat(chatID);
  };

  // Transform recentChats to match Sidebar's expected format
  const sidebarChats = recentChats.map((chat) => ({
    id: chat._id,
    title: chat.title,
  }));

  // Key format: "chat-{id}" for existing chats, "new-{counter}" for new chats
  const containerKey = currentChatID ? `chat-${currentChatID}` : `new-${chatKey}`;

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar
        recentChats={sidebarChats}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        currentChatID={currentChatID}
      />
      <main className="flex-1 flex flex-col min-w-0 lg:ml-0 ml-[48px]">
        <ChatContainer
          key={containerKey}
          chatID={currentChatID}
          initialMessages={currentMessages}
          accessToken={accessToken}
          runtimeUrl={runtimeUrl}
        />
      </main>
    </div>
  );
}
