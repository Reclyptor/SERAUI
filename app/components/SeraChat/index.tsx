"use client";

import { CopilotChat } from "@copilotkit/react-ui";
import type { CSSProperties } from "react";
import type { AssistantMessageProps, UserMessageProps } from "@copilotkit/react-ui";
import { ThinkingMessage } from "../ThinkingMessage";
import { ImageUploadInput } from "../ImageUploadInput";
import { useImageCache } from "../../contexts/ImageCacheContext";

const darkTheme: CSSProperties = {
  "--copilot-kit-primary-color": "#3c3c3c",
  "--copilot-kit-contrast-color": "#cccccc",
  "--copilot-kit-background-color": "#1e1e1e",
  "--copilot-kit-secondary-color": "#252526",
  "--copilot-kit-secondary-contrast-color": "#cccccc",
  "--copilot-kit-separator-color": "#3c3c3c",
  "--copilot-kit-muted-color": "#6e6e6e",
  "--copilot-kit-response-button-background-color": "#2d2d2d",
  "--copilot-kit-response-button-color": "#cccccc",
  "--copilot-kit-message-spacing": "2rem",
} as CSSProperties;

function CustomAssistantMessage(props: AssistantMessageProps) {
  const content = props.message?.content || "";
  const isLoading = props.isLoading || props.isGenerating;
  return (
    <div className="py-4">
      <ThinkingMessage content={content} isLoading={isLoading} />
    </div>
  );
}

function CustomUserMessage({ message }: UserMessageProps) {
  const content = message?.content || "";
  const { getImage } = useImageCache();
  
  const imageIdRegex = /\[IMG:([a-f0-9-]+)\]/g;
  const imageIds = Array.from(content.matchAll(imageIdRegex)).map(m => m[1]);
  const cleanText = content.replace(imageIdRegex, '').trim();
  
  return (
    <div className="copilotKitMessage copilotKitUserMessage">
      {imageIds.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {imageIds.map((id) => {
            const cached = getImage(id);
            return cached ? (
              <img
                key={id}
                src={cached.preview}
                alt="Uploaded"
                className="max-w-[200px] max-h-[200px] object-cover rounded"
              />
            ) : null;
          })}
        </div>
      )}
      {cleanText}
    </div>
  );
}

export function SeraChat() {
  return (
    <div className="flex h-full w-full flex-col" style={darkTheme}>
      <CopilotChat
        className="h-full w-full"
        instructions="You are SERA, a helpful AI assistant. Be friendly, concise, and helpful in your responses."
        labels={{
          title: "SERA",
          initial: "Hi! I'm SERA. How can I help you today?",
          placeholder: "Ask SERA anything...",
        }}
        AssistantMessage={CustomAssistantMessage}
        UserMessage={CustomUserMessage}
        Input={ImageUploadInput}
      />
    </div>
  );
}
