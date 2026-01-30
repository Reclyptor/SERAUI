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
  getChat,
  createChat,
  updateChat,
  type Chat,
  type ChatListItem,
  type Message,
} from "@/app/actions/chat";

interface ChatContextValue {
  currentChatID: string | null;
  currentMessages: Message[];
  recentChats: ChatListItem[];
  isLoading: boolean;
  error: string | null;
  newChat: () => void;
  selectChat: (chatID: string) => Promise<void>;
  saveMessages: (messages: Message[]) => Promise<void>;
  refreshChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [currentChatID, setCurrentChatID] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
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

  // Load chats on mount
  useEffect(() => {
    setIsLoading(true);
    refreshChats().finally(() => setIsLoading(false));
  }, [refreshChats]);

  const newChat = useCallback(() => {
    setCurrentChatID(null);
    setCurrentMessages([]);
  }, []);

  const selectChat = useCallback(async (chatID: string) => {
    try {
      setIsLoading(true);
      const chat = await getChat(chatID);
      setCurrentChatID(chat._id);
      setCurrentMessages(chat.messages);
      setError(null);
    } catch (err) {
      console.error("Failed to load chat:", err);
      setError("Failed to load chat");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveMessages = useCallback(
    async (messages: Message[]) => {
      try {
        if (currentChatID) {
          // Update existing chat
          await updateChat(currentChatID, messages);
        } else {
          // Create new chat
          const newChatData = await createChat(messages);
          setCurrentChatID(newChatData._id);
        }
        // Refresh the chat list to show the new/updated chat
        await refreshChats();
        setError(null);
      } catch (err) {
        console.error("Failed to save messages:", err);
        setError("Failed to save chat");
      }
    },
    [currentChatID, refreshChats]
  );

  return (
    <ChatContext.Provider
      value={{
        currentChatID,
        currentMessages,
        recentChats,
        isLoading,
        error,
        newChat,
        selectChat,
        saveMessages,
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
