"use client";

import { ThinkingMessage } from "../ThinkingMessage";
import { ToolCallMessage } from "../ToolCallMessage";
import { SubagentMessage } from "../SubagentMessage";
import { ImageThumbnail } from "../ImageThumbnail";
import { useImageCache } from "../../contexts/ImageCacheContext";
import type { Attachment, Message } from "@/app/actions/chat";

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
  isLatestAssistant?: boolean;
}

export function ChatMessage({
  message,
  isLoading,
  isLatestAssistant,
}: ChatMessageProps) {
  switch (message.role) {
    case "user":
      return <UserMessage message={message} />;
    case "assistant":
      return (
        <AssistantMessage
          message={message}
          isLoading={isLoading}
          isLatest={isLatestAssistant}
        />
      );
    case "system":
      return null;
  }
}

function UserMessage({ message }: { message: Message }) {
  const content = message.content || "";
  const { getImage } = useImageCache();
  const attachments = message.attachments ?? [];

  return (
    <div className="py-4 max-w-[672px] mx-auto w-full">
      <div className="flex justify-end">
        <div className="bg-background-tertiary text-foreground rounded-2xl px-4 py-2 max-w-[80%] whitespace-pre-wrap">
          {attachments.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {attachments.map((attachment) => (
                <AttachmentPreview
                  key={attachment.id}
                  attachment={attachment}
                  cachedPreview={getImage(attachment.id)?.preview}
                />
              ))}
            </div>
          )}
          {content}
        </div>
      </div>
    </div>
  );
}

function AttachmentPreview({
  attachment,
  cachedPreview,
}: {
  attachment: Attachment;
  cachedPreview?: string;
}) {
  if (attachment.kind === "image") {
    return (
      <ImageThumbnail
        src={
          cachedPreview ?? `/api/v1/agent/attachments/${attachment.id}/content`
        }
        alt={attachment.filename ?? "Uploaded image"}
        size="lg"
      />
    );
  }

  return (
    <a
      href={`/api/v1/agent/attachments/${attachment.id}/content`}
      target="_blank"
      rel="noreferrer"
      className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground hover:border-foreground-muted"
    >
      {attachment.filename ?? "Attachment"}
    </a>
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
  const toolCalls = message.toolCalls;
  const hasToolCalls = toolCalls && toolCalls.length > 0;

  return (
    <div className="py-4 max-w-[672px] mx-auto w-full">
      <ThinkingMessage
        content={message.content || ""}
        thinking={message.thinking}
        thinkingDuration={message.thinkingDuration}
        isLoading={isLoading}
        isLatest={isLatest}
      >
        {hasToolCalls && (
          <div className="mt-1 mb-4">
            {toolCalls.map((tc) =>
              tc.isSubagent ? (
                <SubagentMessage
                  key={tc.toolCallID}
                  toolCall={tc}
                  isLatest={isLatest}
                />
              ) : (
                <ToolCallMessage
                  key={tc.toolCallID}
                  toolCall={tc}
                  isLatest={isLatest}
                />
              ),
            )}
          </div>
        )}
      </ThinkingMessage>
    </div>
  );
}
