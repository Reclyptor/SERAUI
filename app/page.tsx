"use client";

import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { SeraChat } from "./components/SeraChat";

// Mock recent chats for demo
const mockRecentChats = [
  { id: "1", title: "Blu-ray damage from cold weather..." },
  { id: "2", title: "Trademark registration process an..." },
  { id: "3", title: "Image upload processing and visio..." },
  { id: "4", title: "Executor guard counter build opti..." },
  { id: "5", title: "Splitting Anohana chapters with ..." },
];

export default function Home() {
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const handleNewChat = () => {
    setCurrentChatId(null);
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
  };

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar
        recentChats={mockRecentChats}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        currentChatId={currentChatId}
      />
      <main className="flex-1 flex flex-col min-w-0 lg:ml-0 ml-[48px]">
        <SeraChat />
      </main>
    </div>
  );
}
