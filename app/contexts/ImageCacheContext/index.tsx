"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { trimMap } from "@/app/lib/collections";

interface CachedImage {
  id: string;
  preview: string;
  mimeType: string;
}

const IMAGE_CAP = 50;

interface ImageCacheContextType {
  addImage: (id: string, preview: string, mimeType: string) => void;
  getImage: (id: string) => CachedImage | undefined;
  enforceImageCap: () => void;
}

const ImageCacheContext = createContext<ImageCacheContextType | undefined>(
  undefined,
);

export function ImageCacheProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<Map<string, CachedImage>>(new Map());

  // Ref mirror so getImage reads the latest map even when called outside
  // render (e.g. from a stream callback that closed over an old `images`).
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const addImage = useCallback(
    (id: string, preview: string, mimeType: string) => {
      setImages((prev) => {
        const next = new Map(prev);
        next.set(id, { id, preview, mimeType });
        return next;
      });
    },
    [],
  );

  const getImage = useCallback(
    (id: string) => imagesRef.current.get(id),
    [],
  );

  // Caps the cache at IMAGE_CAP entries. Named for what it actually does —
  // the previous "clearOldImages" suggested a TTL but it's a memory ceiling.
  const enforceImageCap = useCallback(() => {
    setImages((prev) => trimMap(prev, IMAGE_CAP));
  }, []);

  const value = useMemo(
    () => ({ addImage, getImage, enforceImageCap }),
    [addImage, getImage, enforceImageCap],
  );

  return (
    <ImageCacheContext.Provider value={value}>
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
