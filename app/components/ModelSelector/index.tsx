"use client";

import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import { getModelDisplayName, groupModelsByProvider } from "@/app/lib/models";
import { ChevronUpDownIcon } from "../Icons";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const grouped = groupModelsByProvider();
  const displayName = getModelDisplayName(selectedModel);

  return (
    <div ref={menuRef} className="relative">
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-background-secondary border border-border rounded-xl shadow-lg py-1 z-50">
          {grouped.map(([label, models]) => (
            <div key={label}>
              <div className="px-3 py-1.5 text-[10px] font-medium text-foreground-muted uppercase tracking-wider">
                {label}
              </div>
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    "w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer",
                    model.id === selectedModel
                      ? "text-accent bg-accent-muted"
                      : "text-foreground hover:bg-background-tertiary"
                  )}
                >
                  {model.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer",
          "text-foreground-muted hover:text-foreground hover:bg-background-tertiary",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <span>{displayName}</span>
        <ChevronUpDownIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
