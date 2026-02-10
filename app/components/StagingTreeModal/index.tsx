"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import {
  X,
  Loader2,
  ChevronRight,
  FolderOpen,
  Folder,
  FileVideo,
  File,
} from "lucide-react";
import { getStagingTree, type FileTreeNode } from "@/app/actions/media";

interface StagingTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
}

export function StagingTreeModal({
  isOpen,
  onClose,
  workflowId,
}: StagingTreeModalProps) {
  const [tree, setTree] = useState<FileTreeNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !workflowId) return;
    setIsLoading(true);
    setError(null);
    getStagingTree(workflowId)
      .then((data) => setTree(data))
      .catch((err) => setError(err.message ?? "Failed to load staging tree"))
      .finally(() => setIsLoading(false));
  }, [isOpen, workflowId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-foreground">
            Staged Output Review
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-background-tertiary text-foreground-muted hover:text-foreground"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-foreground-muted animate-spin" />
            </div>
          )}
          {error && (
            <div className="text-xs text-red-400 text-center py-8">
              {error}
            </div>
          )}
          {tree && tree.length === 0 && (
            <div className="text-xs text-foreground-muted text-center py-8">
              Staging directory is empty.
            </div>
          )}
          {tree && tree.length > 0 && (
            <div className="space-y-0.5">
              {tree.map((node) => (
                <TreeNode key={node.relativePath} node={node} depth={0} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-md border border-border text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const VIDEO_EXTENSIONS = new Set([
  ".mkv",
  ".mp4",
  ".avi",
  ".webm",
  ".m4v",
  ".mov",
]);

function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isDirectory = node.type === "directory";
  const isVideo =
    node.type === "file" &&
    VIDEO_EXTENSIONS.has(
      node.name.slice(node.name.lastIndexOf(".")).toLowerCase(),
    );

  const isSeason = isDirectory && /^Season\s+\d+$/i.test(node.name);
  const isExtras = isDirectory && node.name === "Extras";

  const toggleExpand = useCallback(() => {
    if (isDirectory) setExpanded((prev) => !prev);
  }, [isDirectory]);

  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggleExpand}
        className={clsx(
          "flex items-center gap-1.5 w-full text-left py-1 px-1 rounded hover:bg-background-tertiary/50 text-xs transition-colors",
          isDirectory ? "cursor-pointer" : "cursor-default",
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {/* Expand indicator */}
        {isDirectory ? (
          <ChevronRight
            className={clsx(
              "w-3 h-3 shrink-0 text-foreground-muted transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Icon */}
        {isDirectory ? (
          expanded ? (
            <FolderOpen
              className={clsx(
                "w-3.5 h-3.5 shrink-0",
                isSeason
                  ? "text-blue-400"
                  : isExtras
                    ? "text-amber-400"
                    : "text-foreground-muted",
              )}
            />
          ) : (
            <Folder
              className={clsx(
                "w-3.5 h-3.5 shrink-0",
                isSeason
                  ? "text-blue-400"
                  : isExtras
                    ? "text-amber-400"
                    : "text-foreground-muted",
              )}
            />
          )
        ) : isVideo ? (
          <FileVideo className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
        ) : (
          <File className="w-3.5 h-3.5 shrink-0 text-foreground-muted" />
        )}

        {/* Name */}
        <span
          className={clsx(
            "truncate",
            isDirectory ? "font-medium text-foreground" : "text-foreground",
          )}
        >
          {node.name}
        </span>

        {/* Size */}
        {node.size !== undefined && (
          <span className="ml-auto shrink-0 text-foreground-muted tabular-nums">
            {formatSize(node.size)}
          </span>
        )}

        {/* Child count for directories */}
        {isDirectory && node.children && (
          <span className="ml-auto shrink-0 text-foreground-muted tabular-nums">
            {node.children.length} items
          </span>
        )}
      </button>

      {/* Children */}
      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.relativePath}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
