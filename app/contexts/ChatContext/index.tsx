"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { getChats, type ChatListItem } from "@/app/actions/chat";

interface ChatContextValue {
  recentChats: ChatListItem[];
  isLoading: boolean;
  error: string | null;
  refreshChats: () => Promise<void>;
  sessionId: string;
  startNewChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [recentChats, setRecentChats] = useState<ChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());

  const refreshChats = useCallback(async () => {
    try {
      const chats = await getChats();
      setRecentChats(chats);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch chats:", err);
      setError("Failed to load chats");
    }
  }, []);

  const startNewChat = useCallback(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    setIsLoading(true);
    refreshChats().finally(() => setIsLoading(false));
  }, [refreshChats]);

  return (
    <ChatContext.Provider
      value={{
        recentChats,
        isLoading,
        error,
        refreshChats,
        sessionId,
        startNewChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
