"use client";

import { useState, useRef } from "react";
import clsx from "clsx";
import { useImageCache } from "../../contexts/ImageCacheContext";
import { ImageThumbnail } from "../ImageThumbnail";
import { ImageIcon, SendIcon, StopIcon } from "../Icons";
import { ModelSelector } from "../ModelSelector";
import { AgentSelector } from "../AgentSelector";
import { IconButton } from "../IconButton";
import { ChatInputTextarea } from "../ChatInputTextarea";
import { uploadAttachment, type Attachment } from "@/app/actions/chat";

const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

interface ImageUploadInputProps {
  inProgress: boolean;
  onSend: (text: string, attachments?: Attachment[]) => Promise<void>;
  onStop?: () => void;
  queue: string[];
  onDismissFromQueue: (index: number) => void;
  selectedModel: string | null;
  onModelChange: (spec: string) => void;
  selectedAgentID: string | null;
  onAgentChange: (agentID: string | null) => void;
}

export function ImageUploadInput({
  inProgress,
  onSend,
  onStop,
  queue,
  onDismissFromQueue,
  selectedModel,
  onModelChange,
  selectedAgentID,
  onAgentChange,
}: ImageUploadInputProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<
    Array<{ id: string; file: File; preview: string }>
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addImage, enforceImageCap } = useImageCache();

  const createPreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    const acceptedFiles = Array.from(files).filter((file) => {
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        console.error(
          `[ImageUploadInput] Attachment too large: ${file.name} exceeds 25MB`,
        );
        return false;
      }
      return true;
    });

    const newAttachments = await Promise.all(
      acceptedFiles.map(async (file) => {
        const preview = file.type.startsWith("image/")
          ? await createPreview(file)
          : "";
        return {
          id: crypto.randomUUID(),
          file,
          preview,
        };
      }),
    );

    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (uploading) return;
    if (!message.trim() && attachments.length === 0) return;

    const userMessage = message || "Analyze the attached files";

    try {
      setUploading(true);

      const uploadedAttachments = await Promise.all(
        attachments.map(async (item) => {
          const formData = new FormData();
          formData.append("file", item.file);
          const uploaded = await uploadAttachment(formData);
          if (uploaded.kind === "image" && item.preview) {
            addImage(uploaded.id, item.preview, uploaded.mimeType);
          }
          return uploaded;
        }),
      );

      enforceImageCap();

      setMessage("");
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      await onSend(userMessage, uploadedAttachments);
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send message";
      if (errorMessage !== "Session expired") {
        console.error("[ImageUploadInput] Error:", errorMessage);
      }
    } finally {
      setUploading(false);
    }
  };

  const canSend = message.trim() || attachments.length > 0;

  return (
    <div className="flex flex-col w-full p-4 bg-background items-center">
      {queue.length > 0 && (
        <div className="flex flex-col gap-1 w-full max-w-[672px] px-4 pb-2">
          {queue.map((msg, i) => (
            // The hook's queue is exposed as string[] (display labels only),
            // so we compose a key from index + content to avoid the unstable
            // pure-index key that reused rows on dismiss.
            <div key={`${i}:${msg}`} className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted truncate flex-1">
                Queued: {msg}
              </span>
              <button
                type="button"
                onClick={() => onDismissFromQueue(i)}
                className="text-xs text-foreground-muted hover:text-foreground shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={clsx(
          "relative flex flex-col w-full max-w-[672px] bg-background-secondary rounded-3xl transition-colors",
          isDragging && "ring-2 ring-dashed ring-accent",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {attachments.length > 0 && (
          <div className="flex gap-2 px-4 pt-4 flex-wrap">
            {attachments.map((attachment, index) =>
              attachment.preview ? (
                <ImageThumbnail
                  key={attachment.id}
                  src={attachment.preview}
                  alt={attachment.file.name}
                  onRemove={() => removeAttachment(index)}
                  disabled={uploading}
                />
              ) : (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background-tertiary px-3 py-2 text-xs text-foreground"
                >
                  <span className="max-w-40 truncate">
                    {attachment.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    disabled={uploading}
                    className="text-foreground-muted hover:text-foreground disabled:opacity-50"
                  >
                    x
                  </button>
                </div>
              ),
            )}
          </div>
        )}

        <ChatInputTextarea
          textareaRef={textareaRef}
          value={message}
          onChange={setMessage}
          onSubmit={handleSubmit}
          placeholder={
            isDragging
              ? "Drop files here..."
              : uploading
                ? "Uploading files..."
                : inProgress
                  ? "Queue a message..."
                  : "Reply..."
          }
          autoFocus
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload image"
              aria-label="Upload image"
            >
              <ImageIcon className="w-5 h-5" />
            </IconButton>
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              disabled={inProgress}
            />
            <AgentSelector
              selectedAgentID={selectedAgentID}
              onAgentChange={onAgentChange}
              disabled={inProgress}
            />
          </div>

          <div className="flex items-center gap-2">
            {inProgress && onStop && (
              <IconButton
                size="sm"
                variant="danger"
                onClick={onStop}
                title="Stop generation"
                aria-label="Stop generation"
              >
                <StopIcon className="w-4 h-4" />
              </IconButton>
            )}
            <IconButton
              size="sm"
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSend || uploading}
              title={inProgress ? "Queue message" : "Send message"}
              aria-label={inProgress ? "Queue message" : "Send message"}
            >
              <SendIcon className="w-4 h-4" />
            </IconButton>
          </div>
        </div>

        {isDragging && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-background-tertiary/90 rounded-3xl">
            <div className="text-foreground text-sm font-medium">
              Drop images here
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
