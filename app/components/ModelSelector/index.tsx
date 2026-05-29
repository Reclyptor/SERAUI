"use client";

import { useState, useRef } from "react";
import clsx from "clsx";
import {
  getModelDisplayName,
  groupModelsByProvider,
} from "@/app/lib/models";
import { useModelCatalog } from "@/app/contexts/ModelCatalogContext";
import { useClickOutside } from "@/app/hooks/useClickOutside";
import { ChevronUpDownIcon } from "../Icons";

interface ModelSelectorProps {
  selectedModel: string | null;
  onModelChange: (spec: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const catalog = useModelCatalog();

  useClickOutside(menuRef, isOpen, () => setIsOpen(false));

  const grouped = groupModelsByProvider(catalog);
  const displayName =
    selectedModel === null ? null : getModelDisplayName(catalog, selectedModel);

  const catalogEmpty = catalog.length === 0;

  let buttonLabel: string;
  if (selectedModel === null) {
    buttonLabel = "Select a model";
  } else if (displayName !== null) {
    buttonLabel = displayName;
  } else {
    // selectedModel is non-null but absent from the catalog. Surface the
    // mismatch explicitly rather than silently rendering the raw spec — this
    // is a real inconsistency (deleted model, stale chat state) worth seeing.
    buttonLabel = `Unknown model: ${selectedModel}`;
  }

  return (
    <div ref={menuRef} className="relative">
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-48 bg-background-secondary border border-border rounded-xl shadow-lg py-1 z-50">
          {catalogEmpty ? (
            <div className="px-3 py-1.5 text-sm text-foreground-muted">
              No models available
            </div>
          ) : (
            grouped.map(([provider, models]) => (
              <div key={provider}>
                <div className="px-3 py-1.5 text-[10px] font-medium text-foreground-muted uppercase tracking-wider">
                  {provider}
                </div>
                {models.map((model) => (
                  <button
                    key={model.spec}
                    onClick={() => {
                      onModelChange(model.spec);
                      setIsOpen(false);
                    }}
                    className={clsx(
                      "w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer",
                      model.spec === selectedModel
                        ? "text-accent bg-accent-muted"
                        : "text-foreground hover:bg-background-tertiary",
                    )}
                  >
                    {model.displayName}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer",
          "text-foreground-muted hover:text-foreground hover:bg-background-tertiary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        <span>{buttonLabel}</span>
        <ChevronUpDownIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
