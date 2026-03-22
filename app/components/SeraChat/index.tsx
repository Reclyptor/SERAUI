"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCopilotChatInternal } from "@copilotkit/react-core";
import { ThinkingMessage } from "../ThinkingMessage";
import { ImageUploadInput } from "../ImageUploadInput";
import { ImageThumbnail } from "../ImageThumbnail";
import { WelcomeView } from "../WelcomeView";
import { useImageCache } from "../../contexts/ImageCacheContext";
import { useChat } from "../../contexts/ChatContext";
import type { Message } from "@/app/actions/chat";

interface SeraChatProps {
  chatID: string | null;
  initialMessages: Message[];
  appendMessageRef?: React.MutableRefObject<((msg: Message) => void) | undefined>;
}

function CustomUserMessage({ message }: { message: any }) {
  const content = message.content || "";
  const { getImage } = useImageCache();

  const imageIDRegex = /\[IMG:([a-f0-9-]+)\]/g;
  const imageIDs = Array.from(content.matchAll(imageIDRegex) as IterableIterator<RegExpMatchArray>).map(m => m[1]);
  const cleanText = content.replace(imageIDRegex, '').trim();

  return (
    <div className="py-4 max-w-[672px] mx-auto w-full">
      <div className="flex justify-end">
        <div className="bg-background-tertiary text-foreground rounded-2xl px-4 py-2 max-w-[80%] whitespace-pre-wrap">
          {imageIDs.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {imageIDs.map((id) => {
                const cached = getImage(id);
                return cached ? (
                  <ImageThumbnail key={id} src={cached.preview} alt="Uploaded" size="lg" />
                ) : null;
              })}
            </div>
          )}
          {cleanText}
        </div>
      </div>
    </div>
  );
}

function CustomAssistantMessage({ message, isLoading }: { message: any, isLoading?: boolean }) {
  return (
    <div className="py-4 max-w-[672px] mx-auto w-full">
      <ThinkingMessage content={message.content || ""} isLoading={isLoading} />
    </div>
  );
}

export function SeraChat({
  chatID,
  initialMessages,
  appendMessageRef,
}: SeraChatProps) {
  const {
    messages = [],
    sendMessage,
    isLoading,
    stopGeneration,
    setMessages,
  } = useCopilotChatInternal({});
  const router = useRouter();
  const { createNewChat, updateExistingChat } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const hasSavedRef = useRef(false);
  const hydratedRef = useRef(false);
  const pendingChatCreationRef = useRef(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  // Announcements injected by sibling components
  const [announcements, setAnnouncements] = useState<Message[]>([]);

  useEffect(() => {
    if (appendMessageRef) {
      appendMessageRef.current = (msg: Message) => {
        setAnnouncements((prev) => [
          ...prev,
          { ...msg, id: msg.id ?? crypto.randomUUID() },
        ]);
      };
    }
    return () => {
      if (appendMessageRef) appendMessageRef.current = undefined;
    };
  }, [appendMessageRef]);

  // Hydrate CopilotKit with persisted messages once on mount.
  useEffect(() => {
    if (hydratedRef.current) return;
    if (initialMessages.length > 0) {
      setMessages(initialMessages as any);
    }
    hydratedRef.current = true;
  }, [initialMessages, setMessages]);

  // Save messages when generation completes
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage?.content && !hasSavedRef.current) {
        hasSavedRef.current = true;
        const SAVEABLE_ROLES = new Set(["user", "assistant", "system"]);
        const messagesToSave = messages
          .filter(
            (m: any) =>
              SAVEABLE_ROLES.has(m.role) &&
              typeof m.content === "string" &&
              m.content.length > 0,
          )
          .map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          }));

        if (chatID) {
          // Existing chat: update messages in the backend.
          updateExistingChat(chatID, messagesToSave).then(() => {
            setTimeout(() => {
              hasSavedRef.current = false;
            }, 1000);
          });
        } else if (pendingChatCreationRef.current) {
          // New chat from /new: the message was sent through CopilotKit directly.
          // Create the chat now that we have the full conversation (user + assistant).
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (chatID === null) {
      // New chat from /new — send through CopilotKit directly.
      // The chat will be created in the backend once the AI responds
      // (handled in the save effect via pendingChatCreationRef).
      pendingChatCreationRef.current = true;
    }
    sendMessage({
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    } as any);
  }, [chatID, sendMessage]);

  // CopilotKit messages take priority; fall back to initialMessages before hydration.
  const messagesToRender = messages.length > 0 ? messages : initialMessages;

  const isBusy = isLoading || isCreatingChat;

  // Welcome view on /new with no messages
  if (chatID === null && messagesToRender.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <WelcomeView onSend={handleSendMessage} isLoading={isBusy} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background relative">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pb-4"
      >
        <div className="flex flex-col min-h-full justify-start pt-4">
          {messagesToRender.map((message, index) => {
            const isLastMessage = index === messagesToRender.length - 1;
            const role = (message.role || "").toLowerCase();

            if (role === "user") {
              return <CustomUserMessage key={message.id} message={message} />;
            }

            if (role === "assistant") {
              return (
                <CustomAssistantMessage
                  key={message.id}
                  message={message}
                  isLoading={isLastMessage && isLoading}
                />
              );
            }

            return null;
          })}

          {/* Announcements injected by sibling components */}
          {announcements.map((msg) => (
            <CustomAssistantMessage
              key={msg.id}
              message={msg}
              isLoading={false}
            />
          ))}

          {isLoading && messagesToRender.length > 0 && messagesToRender[messagesToRender.length - 1].role === "user" && (
            <CustomAssistantMessage
              message={{
                id: "temp-thinking",
                role: "assistant",
                content: "",
              }}
              isLoading={true}
            />
          )}
        </div>
      </div>

      <div className="w-full max-w-[672px] mx-auto">
        <ImageUploadInput
          inProgress={isBusy}
          onSend={handleSendMessage}
          onStop={stopGeneration}
        />
      </div>
    </div>
  );
}
