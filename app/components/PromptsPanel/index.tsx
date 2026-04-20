"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { ArrowLeft, RotateCcw, Save, Loader2 } from "lucide-react";
import {
  listPrompts,
  getPrompt,
  savePrompt,
  type PromptListItem,
  type PromptDetail,
} from "@/app/actions/prompts";

export function PromptsPanel() {
  const [prompts, setPrompts] = useState<PromptListItem[]>([]);
  const [selected, setSelected] = useState<PromptDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrompts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await listPrompts();
      setPrompts(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const handleSelect = async (slug: string) => {
    try {
      setError(null);
      const detail = await getPrompt(slug);
      setSelected(detail);
      setDraft(detail.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prompt");
    }
  };

  const handleReset = () => {
    if (selected) {
      setDraft(selected.content);
    }
  };

  const handleSave = async () => {
    if (!selected) return;

    try {
      setSaving(true);
      setError(null);
      const updated = await savePrompt(selected.slug, {
        content: draft,
        extends: selected.extends,
        description: selected.description,
        metadata: selected.metadata,
      });
      setSelected(updated);
      setDraft(updated.content);
      await loadPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prompt");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setSelected(null);
    setDraft("");
    setError(null);
  };

  const isDirty = selected !== null && draft !== selected.content;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center h-14 px-6 shrink-0 border-b border-border">
        <div className="flex items-center gap-2">
          {selected && (
            <button
              onClick={handleBack}
              className="w-7 h-7 flex items-center justify-center rounded-md text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-foreground">
            {selected ? selected.slug : "Prompts"}
          </h2>
          {selected?.extends && (
            <span className="text-xs text-foreground-muted">
              extends {selected.extends}
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Content */}
      {selected ? (
        <PromptEditor
          draft={draft}
          setDraft={setDraft}
          isDirty={isDirty}
          saving={saving}
          onReset={handleReset}
          onSave={handleSave}
        />
      ) : (
        <PromptList
          prompts={prompts}
          loading={loading}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}

function PromptList({
  prompts,
  loading,
  onSelect,
}: {
  prompts: PromptListItem[];
  loading: boolean;
  onSelect: (slug: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">
        No prompts found
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {prompts.map((prompt) => (
        <button
          key={prompt.slug}
          onClick={() => onSelect(prompt.slug)}
          className="w-full text-left px-6 py-3 border-b border-border hover:bg-background-tertiary transition-colors"
        >
          <div className="text-sm font-medium text-foreground">
            {prompt.slug}
          </div>
          {prompt.description && (
            <div className="text-xs text-foreground-muted mt-0.5 truncate">
              {prompt.description}
            </div>
          )}
          {prompt.extends && (
            <div className="text-xs text-foreground-muted mt-0.5">
              extends {prompt.extends}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function PromptEditor({
  draft,
  setDraft,
  isDirty,
  saving,
  onReset,
  onSave,
}: {
  draft: string;
  setDraft: (v: string) => void;
  isDirty: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="flex-1 overflow-hidden p-6">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={clsx(
            "w-full h-full resize-none rounded-lg p-3",
            "bg-background-secondary border border-border",
            "text-sm text-foreground font-mono leading-relaxed",
            "focus:outline-none focus:ring-1 focus:ring-foreground-muted",
          )}
          spellCheck={false}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border shrink-0">
        <button
          onClick={onReset}
          disabled={!isDirty}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
            isDirty
              ? "text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
              : "text-foreground-muted/40 cursor-not-allowed",
          )}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty || saving}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            isDirty && !saving
              ? "bg-foreground text-background hover:opacity-90"
              : "bg-foreground/20 text-foreground/40 cursor-not-allowed",
          )}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Save
        </button>
      </div>
    </>
  );
}
