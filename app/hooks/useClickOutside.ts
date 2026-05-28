"use client";

import { useEffect, type RefObject } from "react";

// Closes a popover / menu when a mousedown lands outside `ref`. Inactive
// when `isOpen` is false, so the listener attaches only while the popover
// is visible.
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  isOpen: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, ref, onClose]);
}
