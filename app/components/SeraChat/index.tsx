"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

export function SeraChat({ chatID, initialMessages }: SeraChatProps) {
  const { messages = [], sendMessage, isLoading, stopGeneration, setMessages } = useCopilotChatInternal({});
  
  const { saveMessages } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const hasSavedRef = useRef(false);

  // Initialize CopilotKit with messages on mount
  useEffect(() => {
    if (setMessages && initialMessages.length > 0) {
      setMessages(initialMessages as any);
    }
  }, []); // Only run once on mount

  // Save messages when generation completes
  useEffect(() => {
    // Detect when loading transitions from true to false (generation complete)
    if (wasLoadingRef.current && !isLoading && messages.length > 0) {
      // Only save if we haven't already saved this set of messages
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage?.content && !hasSavedRef.current) {
        hasSavedRef.current = true;
        const messagesToSave = messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        }));
        saveMessages(messagesToSave).then(() => {
          // Reset flag after a short delay to allow for subsequent saves
          setTimeout(() => {
            hasSavedRef.current = false;
          }, 1000);
        });
      }
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, messages, saveMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = useCallback(async (content: string) => {
    const message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };
    
    sendMessage(message as any);
  }, [sendMessage]);

  // Use CopilotKit messages, or initialMessages for first render before CopilotKit syncs
  const messagesToRender = messages.length > 0 ? messages : initialMessages;

  if (messagesToRender.length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-background">
        <WelcomeView onSend={handleSendMessage} isLoading={isLoading} />
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
          inProgress={isLoading} 
          onSend={handleSendMessage} 
          onStop={stopGeneration}
        />
      </div>
    </div>
  );
}
