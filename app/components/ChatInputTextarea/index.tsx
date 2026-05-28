"use client";

import { type Ref } from "react";

interface ChatInputTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  textareaRef?: Ref<HTMLTextAreaElement>;
}

// Autosizing chat input. Enter (no shift) calls onSubmit. Shared by
// ImageUploadInput (controlled, with attachments) and WelcomeView (empty
// state on /new). Extracted so the two surfaces stay in sync.
export function ChatInputTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  autoFocus,
  textareaRef,
}: ChatInputTextareaProps) {
  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      onInput={(e) => {
        const t = e.currentTarget;
        t.style.height = "auto";
        t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
      }}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      rows={1}
      className="flex-1 bg-transparent text-foreground text-sm px-4 pt-4 pb-2 resize-none outline-none placeholder-foreground-muted min-h-[24px] max-h-[200px]"
    />
  );
}
