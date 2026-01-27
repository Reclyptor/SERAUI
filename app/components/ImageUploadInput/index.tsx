"use client";

import { useState, useRef } from "react";
import { useImageCache } from "../../contexts/ImageCacheContext";
import { IconButton } from "../IconButton";
import { ImageThumbnail } from "../ImageThumbnail";
import { ImageIcon, SendIcon, StopIcon } from "../Icons";

interface ImageUploadInputProps {
  inProgress: boolean;
  onSend: (text: string) => Promise<any>;
  onStop?: () => void;
}

export function ImageUploadInput({ inProgress, onSend, onStop }: ImageUploadInputProps) {
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

    const response = await fetch('http://localhost:3001/copilotkit/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload image');
    }

    const data = await response.json();
    return data.imageId;
  };

  const handleSubmit = async () => {
    if (!message.trim() && images.length === 0) return;

    const userMessage = message || "Analyze this image";

    try {
      setUploading(true);

      // Upload all images first and get their IDs
      const imageIds = await Promise.all(
        images.map(async (img) => {
          const id = await uploadImage(img.file);
          // Cache the preview for later display
          addImage(id, img.preview, img.file.type);
          return id;
        })
      );

      clearOldImages();

      // Build message with image ID references
      let finalMessage = userMessage;
      if (imageIds.length > 0) {
        const imageMarkers = imageIds.map(id => `[IMG:${id}]`).join(' ');
        finalMessage = `${userMessage} ${imageMarkers}`;
      }

      // Clear input immediately after sending
      setMessage("");
      setImages([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      await onSend(finalMessage);
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(error instanceof Error ? error.message : 'Failed to send message');
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

  return (
    <div className="flex flex-col w-full border-t border-[#3c3c3c] bg-[#1e1e1e]">
      {images.length > 0 && (
        <div className="flex gap-2 p-3 flex-wrap border-b border-[#3c3c3c]">
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

      <div
        className={`relative flex items-end gap-3 p-3 transition-colors ${
          isDragging ? "bg-[#2d2d2d] border-2 border-dashed border-[#666666]" : ""
        }`}
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

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={isDragging ? "Drop images here..." : uploading ? "Uploading images..." : "Ask SERA anything..."}
          className="flex-1 bg-[#252526] text-[#cccccc] text-sm rounded-lg px-4 py-2.5 resize-none outline-none border border-[#3c3c3c] focus:border-[#525252] placeholder-[#6e6e6e] min-h-[40px] max-h-[200px]"
          rows={1}
          disabled={inProgress || uploading}
        />

        <IconButton
          onClick={() => fileInputRef.current?.click()}
          disabled={inProgress || uploading}
          title="Upload image"
        >
          <ImageIcon />
        </IconButton>

        {inProgress && onStop ? (
          <IconButton onClick={onStop} variant="danger" title="Stop generation">
            <StopIcon />
          </IconButton>
        ) : (
          <IconButton
            onClick={handleSubmit}
            disabled={(!message.trim() && images.length === 0) || inProgress || uploading}
            title="Send message"
          >
            <SendIcon />
          </IconButton>
        )}

        {isDragging && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-[#2d2d2d] bg-opacity-80 rounded">
            <div className="text-[#cccccc] text-sm font-medium">
              Drop images here
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
