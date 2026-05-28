"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { Loader2, Trash2, Check, X } from "lucide-react";
import {
  listMemories,
  deleteMemory,
  type MemoryEntry,
} from "@/app/actions/memories";
import { formatTimestamp } from "@/app/lib/time";

export function MemoriesPanel() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await listMemories();
      setMemories(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      setError(null);
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memory");
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center h-14 px-6 shrink-0 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Memories</h2>
        {!loading && (
          <span className="ml-2 text-xs text-foreground-muted">
            {memories.length}
          </span>
        )}
      </div>

      {error && (
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
        </div>
      ) : memories.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">
          No memories found
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {memories.map((memory) => (
            <MemoryRow
              key={memory.id}
              memory={memory}
              isConfirming={confirmingId === memory.id}
              isDeleting={deletingId === memory.id}
              onRequestDelete={() => setConfirmingId(memory.id)}
              onCancelDelete={() => setConfirmingId(null)}
              onConfirmDelete={() => handleDelete(memory.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryRow({
  memory,
  isConfirming,
  isDeleting,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  memory: MemoryEntry;
  isConfirming: boolean;
  isDeleting: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <div className="group flex items-start gap-3 px-6 py-3 border-b border-border hover:bg-background-tertiary transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground whitespace-pre-wrap break-words">
          {memory.content}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs text-foreground-muted/70">
            {formatTimestamp(memory.createdAt)}
          </span>
          {memory.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-background-secondary text-foreground-muted border border-border"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isConfirming ? (
          <>
            <button
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className={clsx(
                "w-7 h-7 flex items-center justify-center rounded-md transition-colors",
                "text-red-400 hover:text-red-300 hover:bg-red-500/10",
                isDeleting && "opacity-50 cursor-not-allowed",
              )}
              title="Confirm delete"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={onCancelDelete}
              disabled={isDeleting}
              className={clsx(
                "w-7 h-7 flex items-center justify-center rounded-md transition-colors",
                "text-foreground-muted hover:text-foreground hover:bg-background-secondary",
                isDeleting && "opacity-50 cursor-not-allowed",
              )}
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            onClick={onRequestDelete}
            className={clsx(
              "w-7 h-7 flex items-center justify-center rounded-md transition-colors",
              "text-foreground-muted opacity-0 group-hover:opacity-100",
              "hover:text-red-400 hover:bg-red-500/10",
            )}
            title="Delete memory"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

