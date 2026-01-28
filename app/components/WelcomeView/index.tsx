"use client";

import clsx from "clsx";
import { ImageIcon, SendIcon } from "../Icons";

interface WelcomeViewProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export function WelcomeView({ onSend, isLoading }: WelcomeViewProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("message") as HTMLTextAreaElement;
    const message = input.value.trim();
    if (message) {
      onSend(message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 pt-[32vh]">
      {/* Greeting */}
      <div className="flex items-center gap-3 mb-8">
        <img src="/sera.png" alt="SERA" className="w-10 h-10" />
        <h1 className="text-4xl font-light text-foreground">
          Hello, how can I help?
        </h1>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="w-full max-w-[672px]">
        <div className="relative flex flex-col bg-background-secondary rounded-3xl">
          <textarea
            name="message"
            placeholder="How can I help you today?"
            className="flex-1 bg-transparent text-foreground text-sm px-4 pt-4 pb-2 resize-none outline-none placeholder-foreground-muted min-h-[24px] max-h-[200px]"
            rows={1}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
            }}
          />

          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
                title="Attach file"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent hover:bg-accent-hover text-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send message"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
