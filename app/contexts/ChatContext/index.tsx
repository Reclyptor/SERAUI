"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  getChats,
  createChat,
  updateChat,
  type ChatListItem,
  type Message,
} from "@/app/actions/chat";

interface ChatContextValue {
  recentChats: ChatListItem[];
  isLoading: boolean;
  error: string | null;
  createNewChat: (messages: Message[]) => Promise<string>;
  updateExistingChat: (chatID: string, messages: Message[]) => Promise<void>;
  refreshChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [recentChats, setRecentChats] = useState<ChatListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    setIsLoading(true);
    refreshChats().finally(() => setIsLoading(false));
  }, [refreshChats]);

  const createNewChat = useCallback(
    async (messages: Message[]): Promise<string> => {
      try {
        const newChatData = await createChat(messages);
        await refreshChats();
        setError(null);
        return newChatData._id;
      } catch (err) {
        console.error("Failed to create chat:", err);
        setError("Failed to save chat");
        throw err;
      }
    },
    [refreshChats],
  );

  const updateExistingChat = useCallback(
    async (chatID: string, messages: Message[]): Promise<void> => {
      try {
        await updateChat(chatID, messages);
        await refreshChats();
        setError(null);
      } catch (err) {
        console.error("Failed to update chat:", err);
        setError("Failed to save chat");
      }
    },
    [refreshChats],
  );

  return (
    <ChatContext.Provider
      value={{
        recentChats,
        isLoading,
        error,
        createNewChat,
        updateExistingChat,
        refreshChats,
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
