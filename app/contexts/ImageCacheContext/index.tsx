"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface CachedImage {
  id: string;
  preview: string;
  mimeType: string;
}

interface ImageCacheContextType {
  addImage: (id: string, preview: string, mimeType: string) => void;
  getImage: (id: string) => CachedImage | undefined;
  clearOldImages: () => void;
}

const ImageCacheContext = createContext<ImageCacheContextType | undefined>(undefined);

export function ImageCacheProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<Map<string, CachedImage>>(new Map());

  const addImage = (id: string, preview: string, mimeType: string) => {
    setImages(prev => {
      const next = new Map(prev);
      next.set(id, { id, preview, mimeType });
      return next;
    });
  };

  const getImage = (id: string): CachedImage | undefined => {
    return images.get(id);
  };

  const clearOldImages = () => {
    // Keep only last 50 images to prevent memory leak
    if (images.size > 50) {
      const entries = Array.from(images.entries());
      const toKeep = entries.slice(-50);
      setImages(new Map(toKeep));
    }
  };

  return (
    <ImageCacheContext.Provider value={{ addImage, getImage, clearOldImages }}>
      {children}
    </ImageCacheContext.Provider>
  );
}

export function useImageCache() {
  const context = useContext(ImageCacheContext);
  if (!context) {
    throw new Error("useImageCache must be used within ImageCacheProvider");
  }
  return context;
}
