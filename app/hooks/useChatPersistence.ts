"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "../contexts/ChatContext";
import type { Message } from "@/app/actions/chat";

interface UseChatPersistenceOptions {
  chatID: string | null;
  messages: Message[];
  isLoading: boolean;
}

interface UseChatPersistenceReturn {
  isCreatingChat: boolean;
  markPendingCreation: () => void;
}

const SAVEABLE_ROLES = new Set(["user", "assistant", "system"]);

export function useChatPersistence({
  chatID,
  messages,
  isLoading,
}: UseChatPersistenceOptions): UseChatPersistenceReturn {
  const router = useRouter();
  const { createNewChat, updateExistingChat } = useChat();
  const wasLoadingRef = useRef(false);
  const hasSavedRef = useRef(false);
  const pendingChatCreationRef = useRef(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const markPendingCreation = useCallback(() => {
    pendingChatCreationRef.current = true;
  }, []);

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (
        lastMessage?.role === "assistant" &&
        lastMessage?.content &&
        !hasSavedRef.current
      ) {
        hasSavedRef.current = true;

        const messagesToSave = messages
          .filter(
            (m) =>
              SAVEABLE_ROLES.has(m.role) &&
              typeof m.content === "string" &&
              m.content.length > 0
          )
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          }));

        if (chatID) {
          updateExistingChat(chatID, messagesToSave).then(() => {
            setTimeout(() => {
              hasSavedRef.current = false;
            }, 1000);
          });
        } else if (pendingChatCreationRef.current) {
          pendingChatCreationRef.current = false;
          setIsCreatingChat(true);
          createNewChat(messagesToSave)
            .then((newChatID) => {
              router.replace(`/chat/${newChatID}`);
            })
            .catch((err) => {
              console.error("Failed to create chat after AI response:", err);
            })
            .finally(() => {
              setIsCreatingChat(false);
              setTimeout(() => {
                hasSavedRef.current = false;
              }, 1000);
            });
        }
      }
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, messages, updateExistingChat, createNewChat, chatID, router]);

  return { isCreatingChat, markPendingCreation };
}
