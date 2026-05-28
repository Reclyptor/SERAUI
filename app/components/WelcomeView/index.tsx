"use client";

import { useState } from "react";
import { ImageIcon, SendIcon } from "../Icons";
import { ModelSelector } from "../ModelSelector";
import { IconButton } from "../IconButton";
import { ChatInputTextarea } from "../ChatInputTextarea";

interface WelcomeViewProps {
  onSend: (message: string) => void;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function WelcomeView({
  onSend,
  selectedModel,
  onModelChange,
}: WelcomeViewProps) {
  const [message, setMessage] = useState("");

  const submit = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage("");
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 pt-[32vh]">
      <div className="flex items-center gap-3 mb-8">
        <img src="/sera.png" alt="SERA" className="w-10 h-10" />
        <h1 className="text-4xl font-light text-foreground">
          Hello, how can I help?
        </h1>
      </div>

      <div className="w-full max-w-[672px]">
        <div className="relative flex flex-col bg-background-secondary rounded-3xl">
          <ChatInputTextarea
            value={message}
            onChange={setMessage}
            onSubmit={submit}
            placeholder="How can I help you today?"
          />

          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <IconButton
                size="sm"
                title="Attach file"
                aria-label="Attach file"
              >
                <ImageIcon className="w-5 h-5" />
              </IconButton>
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={onModelChange}
              />
            </div>

            <IconButton
              size="sm"
              variant="primary"
              onClick={submit}
              title="Send message"
              aria-label="Send message"
            >
              <SendIcon className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
