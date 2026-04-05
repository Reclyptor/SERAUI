"use client";

import { useState, useRef } from "react";
import clsx from "clsx";
import { useImageCache } from "../../contexts/ImageCacheContext";
import { ImageThumbnail } from "../ImageThumbnail";
import { ImageIcon, SendIcon, StopIcon } from "../Icons";
import { uploadImage as uploadImageAction } from "@/app/actions/chat";

interface ImageUploadInputProps {
  inProgress: boolean;
  onSend: (text: string) => Promise<any>;
  onStop?: () => void;
  queue: string[];
  onDismissFromQueue: (index: number) => void;
}

export function ImageUploadInput({ inProgress, onSend, onStop, queue, onDismissFromQueue }: ImageUploadInputProps) {
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<Array<{ id: string; file: File; preview: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addImage, clearOldImages } = useImageCache();

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

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    const newImages = await Promise.all(
      imageFiles.map(async (file) => {
        const preview = await createPreview(file);
        return {
          id: crypto.randomUUID(),
          file,
          preview,
        };
      })
    );

    setImages((prev) => [...prev, ...newImages]);
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

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const result = await uploadImageAction(formData);
    return result.imageID;
  };

  const handleSubmit = async () => {
    if (uploading) return;
    if (!message.trim() && images.length === 0) return;

    const userMessage = message || "Analyze this image";

    try {
      setUploading(true);

      const imageIDs = await Promise.all(
        images.map(async (img) => {
          const id = await uploadImage(img.file);
          addImage(id, img.preview, img.file.type);
          return id;
        })
      );

      clearOldImages();

      let finalMessage = userMessage;
      if (imageIDs.length > 0) {
        const imageMarkers = imageIDs.map(id => `[IMG:${id}]`).join(' ');
        finalMessage = `${userMessage} ${imageMarkers}`;
      }

      setMessage("");
      setImages([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      await onSend(finalMessage);
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      if (errorMessage !== "Session expired") {
        console.error("[ImageUploadInput] Error:", errorMessage);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
  };

  const canSend = message.trim() || images.length > 0;

  const actionButtonBase =
    "w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col w-full p-4 bg-background items-center">
      {queue.length > 0 && (
        <div className="flex flex-col gap-1 w-full max-w-[672px] px-4 pb-2">
          {queue.map((msg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-foreground-muted truncate flex-1">
                Queued: {msg}
              </span>
              <button
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
          isDragging && "ring-2 ring-dashed ring-accent"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {images.length > 0 && (
          <div className="flex gap-2 px-4 pt-4 flex-wrap">
            {images.map((image, index) => (
              <ImageThumbnail
                key={image.id}
                src={image.preview}
                alt={image.file.name}
                onRemove={() => removeImage(index)}
                disabled={uploading}
              />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={isDragging ? "Drop images here..." : uploading ? "Uploading images..." : inProgress ? "Queue a message..." : "Reply..."}
          className="flex-1 bg-transparent text-foreground text-sm px-4 pt-4 pb-2 resize-none outline-none placeholder-foreground-muted min-h-[24px] max-h-[200px]"
          rows={1}
          autoFocus
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors disabled:opacity-50"
              title="Upload image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {inProgress && onStop && (
              <button
                onClick={onStop}
                className={clsx(actionButtonBase, "bg-[#e74c3c] hover:bg-[#c0392b] text-white")}
                title="Stop generation"
              >
                <StopIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSend || uploading}
              className={clsx(actionButtonBase, "bg-accent hover:bg-accent-hover text-background")}
              title={inProgress ? "Queue message" : "Send message"}
            >
              <SendIcon className="w-4 h-4" />
            </button>
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
