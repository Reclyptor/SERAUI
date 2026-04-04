"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAgentChat } from "../../hooks/useAgentChat";
import { useChatPersistence } from "../../hooks/useChatPersistence";
import { ChatMessage } from "../ChatMessage";
import { ImageUploadInput } from "../ImageUploadInput";
import { WelcomeView } from "../WelcomeView";
import type { Message } from "@/app/actions/chat";

interface SeraChatProps {
  chatID: string | null;
  initialMessages: Message[];
  appendMessageRef?: React.MutableRefObject<
    ((msg: Message) => void) | undefined
  >;
}

export function SeraChat({
  chatID,
  initialMessages,
  appendMessageRef,
}: SeraChatProps) {
  const { messages, sendMessage, isLoading, stopGeneration } = useAgentChat({
    initialMessages,
  });

  const { isCreatingChat, markPendingCreation } = useChatPersistence({
    chatID,
    messages,
    isLoading,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [announcements, setAnnouncements] = useState<Message[]>([]);

  // Expose append for sibling components
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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (chatID === null) {
        markPendingCreation();
      }
      await sendMessage(content);
    },
    [chatID, sendMessage, markPendingCreation]
  );

  const isBusy = isLoading || isCreatingChat;

  // Welcome view on /new with no messages
  if (chatID === null && messages.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <WelcomeView onSend={handleSendMessage} isLoading={isBusy} />
      </div>
    );
  }

  const showPendingIndicator =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "user";

  const lastAssistantIndex = messages.findLastIndex((m) => m.role === "assistant");

  return (
    <div className="flex h-full w-full flex-col bg-background relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-col min-h-full justify-start pt-4">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLoading={index === messages.length - 1 && isLoading}
              isLatestAssistant={index === lastAssistantIndex}
            />
          ))}

          {announcements.map((msg) => (
            <ChatMessage key={msg.id} message={msg} isLoading={false} />
          ))}

          {showPendingIndicator && (
            <ChatMessage
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
