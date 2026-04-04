"use client";

import { ThinkingMessage } from "../ThinkingMessage";
import { ImageThumbnail } from "../ImageThumbnail";
import { useImageCache } from "../../contexts/ImageCacheContext";
import type { Message } from "@/app/actions/chat";

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
  isLatestAssistant?: boolean;
}

export function ChatMessage({ message, isLoading, isLatestAssistant }: ChatMessageProps) {
  const role = (message.role || "").toLowerCase();

  if (role === "user") {
    return <UserMessage message={message} />;
  }

  if (role === "assistant") {
    return <AssistantMessage message={message} isLoading={isLoading} isLatest={isLatestAssistant} />;
  }

  return null;
}

function UserMessage({ message }: { message: Message }) {
  const content = message.content || "";
  const { getImage } = useImageCache();

  const imageIDRegex = /\[IMG:([a-f0-9-]+)\]/g;
  const imageIDs = Array.from(
    content.matchAll(imageIDRegex) as IterableIterator<RegExpMatchArray>
  ).map((m) => m[1]);
  const cleanText = content.replace(imageIDRegex, "").trim();

  return (
    <div className="py-4 max-w-[672px] mx-auto w-full">
      <div className="flex justify-end">
        <div className="bg-background-tertiary text-foreground rounded-2xl px-4 py-2 max-w-[80%] whitespace-pre-wrap">
          {imageIDs.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {imageIDs.map((id) => {
                const cached = getImage(id);
                return cached ? (
                  <ImageThumbnail
                    key={id}
                    src={cached.preview}
                    alt="Uploaded"
                    size="lg"
                  />
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

function AssistantMessage({
  message,
  isLoading,
  isLatest,
}: {
  message: Message;
  isLoading?: boolean;
  isLatest?: boolean;
}) {
  return (
    <div className="py-4 max-w-[672px] mx-auto w-full">
      <ThinkingMessage content={message.content || ""} isLoading={isLoading} isLatest={isLatest} />
    </div>
  );
}
