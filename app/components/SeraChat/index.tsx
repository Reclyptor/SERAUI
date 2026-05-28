"use client";

import { useEffect, useRef } from "react";
import { useAgentChat } from "../../hooks/useAgentChat";
import { useChat } from "../../contexts/ChatContext";
import { ChatMessage } from "../ChatMessage";
import { ConfirmationCard } from "../ConfirmationCard";
import { ImageUploadInput } from "../ImageUploadInput";
import { WelcomeView } from "../WelcomeView";
import { DEFAULT_MODEL } from "@/app/lib/models";
import type { Message } from "@/app/actions/chat";

interface SeraChatProps {
  chatID: string | null;
  initialMessages: Message[];
  initialModel?: string;
}

export function SeraChat({
  chatID,
  initialMessages,
  initialModel,
}: SeraChatProps) {
  const { refreshChats } = useChat();
  const {
    messages,
    sendMessage,
    isLoading,
    chatID: activeChatID,
    stopGeneration,
    queue,
    dismissFromQueue,
    pendingConfirmations,
    resolveConfirmation,
    model,
    setModel,
  } = useAgentChat({
    initialMessages,
    chatID,
    initialModel,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasNavigatedRef = useRef(false);

  // Update URL + refresh sidebar after streaming completes
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (prevLoadingRef.current && !isLoading) {
      if (!chatID && activeChatID && !hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        window.history.replaceState(null, "", `/chat/${activeChatID}`);
      }
      refreshChats();
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, chatID, activeChatID, refreshChats]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, pendingConfirmations]);

  // Welcome view on /new with no messages
  if (chatID === null && messages.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <WelcomeView
          onSend={sendMessage}
          selectedModel={model ?? DEFAULT_MODEL}
          onModelChange={setModel}
        />
      </div>
    );
  }

  const showPendingIndicator =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "user";

  const lastAssistantIndex = messages.findLastIndex(
    (m) => m.role === "assistant",
  );

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

          {pendingConfirmations.map((c) => (
            <ConfirmationCard
              key={c.confirmationID}
              confirmation={c}
              onResolve={resolveConfirmation}
            />
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
          inProgress={isLoading}
          onSend={sendMessage}
          onStop={stopGeneration}
          queue={queue}
          onDismissFromQueue={dismissFromQueue}
          selectedModel={model ?? DEFAULT_MODEL}
          onModelChange={setModel}
        />
      </div>
    </div>
  );
}
