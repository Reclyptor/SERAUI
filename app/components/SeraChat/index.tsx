"use client";

import { useEffect, useRef, useState } from "react";
import { useCopilotChatInternal } from "@copilotkit/react-core";
import { ThinkingMessage } from "../ThinkingMessage";
import { ImageUploadInput } from "../ImageUploadInput";
import { ImageThumbnail } from "../ImageThumbnail";
import { WelcomeView } from "../WelcomeView";
import { useImageCache } from "../../contexts/ImageCacheContext";

function CustomUserMessage({ message }: { message: any }) {
  const content = message.content || "";
  const { getImage } = useImageCache();
  
  const imageIdRegex = /\[IMG:([a-f0-9-]+)\]/g;
  const imageIds = Array.from(content.matchAll(imageIdRegex)).map(m => m[1]);
  const cleanText = content.replace(imageIdRegex, '').trim();
  
  return (
    <div className="py-4 max-w-[672px] mx-auto w-full">
      <div className="flex justify-end">
        <div className="bg-background-tertiary text-foreground rounded-2xl px-4 py-2 max-w-[80%] whitespace-pre-wrap">
          {imageIds.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {imageIds.map((id) => {
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

export function SeraChat() {
  const { messages = [], sendMessage, isLoading, stopGeneration } = useCopilotChatInternal({
    instructions: "You are SERA, a helpful AI assistant. Be friendly, concise, and helpful in your responses."
  });
  
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync local messages with visible messages when they update
  useEffect(() => {
    if (messages && messages.length > 0) {
      setLocalMessages(messages);
    }
  }, [messages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, localMessages, isLoading]);

  const handleSendMessage = async (content: string) => {
    const message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };
    
    // Optimistic update
    setLocalMessages(prev => [...prev, message]);
    
    sendMessage(message as any);
  };

  const messagesToRender = (messages && messages.length > 0) ? messages : localMessages;

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
