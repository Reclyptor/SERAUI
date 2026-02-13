"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import clsx from "clsx";
import {
  X,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  AlertTriangle,
  ThumbsDown,
} from "lucide-react";
import { useWorkflows, type ActiveWorkflow } from "../../contexts/WorkflowContext";
import {
  listSeriesRoots,
  startThreadWorkflow,
  finalizeThreadWorkflow,
  type SeriesRoot,
  type OrganizeLibraryProgress,
  type WorkflowStage,
} from "@/app/actions/media";

interface WorkflowSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chatID: string | null;
  onWorkflowStarted?: (seriesName: string) => void;
}

export function WorkflowSidebar({
  isOpen,
  onClose,
  chatID,
  onWorkflowStarted,
}: WorkflowSidebarProps) {
  const {
    activeWorkflows,
    currentThreadId,
    cancelWorkflow,
    clearTerminalWorkflows,
  } = useWorkflows();

  const [seriesRoots, setSeriesRoots] = useState<SeriesRoot[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingRoots, setIsLoadingRoots] = useState(false);
  const [startingWorkflows, setStartingWorkflows] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingRoots(true);
    listSeriesRoots()
      .then((roots) => setSeriesRoots(roots))
      .catch(() => setSeriesRoots([]))
      .finally(() => setIsLoadingRoots(false));
  }, [isOpen]);

  const filteredRoots = useMemo(() => {
    if (!searchQuery.trim()) return seriesRoots;
    const query = searchQuery.toLowerCase();
    return seriesRoots.filter((root) =>
      root.name.toLowerCase().includes(query),
    );
  }, [seriesRoots, searchQuery]);

  const handleStartWorkflow = useCallback(
    async (seriesRoot: SeriesRoot) => {
      if (!chatID || startingWorkflows.has(seriesRoot.path)) return;
      setStartingWorkflows((prev) => new Set(prev).add(seriesRoot.path));
      try {
        await startThreadWorkflow(chatID, seriesRoot.path);
        onWorkflowStarted?.(seriesRoot.name);
      } catch (err) {
        console.error("Failed to start workflow:", err);
      } finally {
        setStartingWorkflows((prev) => {
          const next = new Set(prev);
          next.delete(seriesRoot.path);
          return next;
        });
      }
    },
    [chatID, startingWorkflows, onWorkflowStarted],
  );

  if (!isOpen) return null;

  const terminalCount = activeWorkflows.filter(
    (wf) =>
      wf.status === "completed" ||
      wf.status === "failed" ||
      wf.status === "canceled",
  ).length;

  return (
    <aside className="w-[320px] shrink-0 border-l border-border bg-background-secondary flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-foreground">
          Media Organizer
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-background-tertiary text-foreground-muted hover:text-foreground"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search series..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-background-tertiary border border-border rounded-md text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      {/* Series Grid */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {isLoadingRoots ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-foreground-muted animate-spin" />
          </div>
        ) : filteredRoots.length === 0 ? (
          <div className="text-xs text-foreground-muted text-center py-8">
            {searchQuery ? "No series match your search" : "No series found"}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredRoots.map((root) => {
              const isStarting = startingWorkflows.has(root.path);
              const isDisabled = isStarting || !chatID;

              return (
                <button
                  key={root.path}
                  type="button"
                  onClick={() => handleStartWorkflow(root)}
                  disabled={isDisabled}
                  className={clsx(
                    "w-full text-left px-3 py-2.5 rounded-lg border transition-colors text-xs",
                    isDisabled
                      ? "border-border bg-background-tertiary/50 text-foreground-muted cursor-not-allowed"
                      : "border-border hover:border-accent/50 hover:bg-background-tertiary text-foreground cursor-pointer",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{root.name}</span>
                    {isStarting && (
                      <Loader2 className="w-3 h-3 shrink-0 text-foreground-muted animate-spin" />
                    )}
                    {!isStarting && (
                      <Play className="w-3 h-3 shrink-0 text-foreground-muted" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Workflows */}
      {activeWorkflows.length > 0 && (
        <div className="border-t border-border px-3 py-2 shrink-0 max-h-[280px] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">
              Workflows
            </span>
            {terminalCount > 0 && (
              <button
                type="button"
                onClick={clearTerminalWorkflows}
                className="text-[10px] text-foreground-muted hover:text-foreground"
              >
                Clear done
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {activeWorkflows.map((wf) => (
              <WorkflowCard
                key={wf.workflowId}
                workflow={wf}
                threadId={currentThreadId}
                onCancel={() => cancelWorkflow(wf.workflowId)}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Stage-specific label ─────────────────────────────────────────────

function getStageLabel(stage: WorkflowStage): string {
  switch (stage) {
    case "copying":
      return "Copying files";
    case "fetching_metadata":
      return "Fetching metadata";
    case "processing_folders":
      return "Processing folders";
    case "structuring":
      return "Structuring";
    case "awaiting_finalize":
      return "Ready for review";
    case "finalizing":
      return "Finalizing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    default:
      return String(stage).replaceAll("_", " ");
  }
}

// ── Workflow card ────────────────────────────────────────────────────

function WorkflowCard({
  workflow,
  threadId,
  onCancel,
}: {
  workflow: ActiveWorkflow;
  threadId: string | null;
  onCancel: () => void;
}) {
  const { progress, status } = workflow;
  const p = progress as OrganizeLibraryProgress | null;
  const isRunning = status === "running" || status === "unknown";
  const isTerminal =
    status === "completed" || status === "failed" || status === "canceled";
  const stage = p?.workflowStage ?? (status as WorkflowStage);

  const isAwaiting = stage === "awaiting_finalize";

  const StatusIcon = isTerminal
    ? status === "completed"
      ? CheckCircle2
      : XCircle
    : isAwaiting
      ? AlertTriangle
      : Loader2;

  const iconColor = isTerminal
    ? status === "completed"
      ? "text-emerald-400"
      : "text-foreground-muted"
    : isAwaiting
      ? "text-amber-400"
      : "text-accent";

  return (
    <div className="rounded-lg border border-border px-3 py-2 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <StatusIcon
          className={clsx(
            "w-3 h-3 shrink-0",
            iconColor,
            isRunning && !isAwaiting && "animate-spin",
          )}
        />
        <span className="text-foreground truncate">
          {getStageLabel(stage)}
        </span>
      </div>

      {p && <WorkflowCardProgress progress={p} />}

      <div className="flex items-center gap-2 mt-1.5">
        {isRunning && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] px-2 py-0.5 rounded border border-border text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
          >
            Cancel
          </button>
        )}
        {p?.canFinalize && p?.awaitingFinalApproval && threadId && (
          <>
            <button
              type="button"
              onClick={() =>
                void finalizeThreadWorkflow(
                  threadId,
                  workflow.workflowId,
                  false,
                )
              }
              className="text-[10px] px-2 py-0.5 rounded border border-red-400/50 text-red-400 hover:bg-red-400/10 flex items-center gap-1"
            >
              <ThumbsDown className="w-2.5 h-2.5" />
              Reject
            </button>
            <button
              type="button"
              onClick={() =>
                void finalizeThreadWorkflow(
                  threadId,
                  workflow.workflowId,
                  true,
                )
              }
              className="text-[10px] px-2 py-0.5 rounded border border-accent/50 text-accent hover:bg-accent/10"
            >
              Approve
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Workflow card progress (stage-aware) ─────────────────────────────

function WorkflowCardProgress({
  progress,
}: {
  progress: OrganizeLibraryProgress;
}) {
  const stage = progress.workflowStage;

  switch (stage) {
    case "copying": {
      const cp = progress.copyProgress;
      if (!cp) {
        return (
          <>
            <div className="text-foreground-muted mb-1.5">Copying files…</div>
            <div className="h-1 bg-background-tertiary rounded-full overflow-hidden mb-1.5 relative">
              <div className="absolute inset-0 h-full w-1/3 bg-accent rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]" />
            </div>
          </>
        );
      }
      const pct =
        cp.totalFiles > 0
          ? Math.round((cp.filesCopied / cp.totalFiles) * 100)
          : 0;
      return (
        <>
          <div className="text-foreground-muted mb-1.5 tabular-nums">
            {cp.filesCopied}/{cp.totalFiles} files
            {cp.currentFiles.length > 0 &&
              ` (${cp.currentFiles.length} active)`}
          </div>
          <div className="h-1 bg-background-tertiary rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      );
    }

    case "fetching_metadata": {
      const meta = progress.metadataSummary;
      return (
        <>
          <div className="text-foreground-muted mb-1.5">
            {meta?.seriesName
              ? `${meta.seriesName}`
              : "Searching AniList…"}
          </div>
          <div className="h-1 bg-background-tertiary rounded-full overflow-hidden mb-1.5 relative">
            <div className="absolute inset-0 h-full w-1/3 bg-accent rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]" />
          </div>
        </>
      );
    }

    case "processing_folders": {
      const total = progress.totalFolders;
      const done = progress.foldersCompleted + progress.foldersFailed;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return (
        <>
          <div className="flex items-center gap-2 text-foreground-muted mb-1.5">
            <span className="tabular-nums">
              {done}/{total} folders
            </span>
            <span className="tabular-nums">
              {progress.resolvedCoreEpisodeCount}/
              {progress.expectedCoreEpisodeCount} ep
            </span>
          </div>
          <div className="h-1 bg-background-tertiary rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      );
    }

    case "structuring": {
      const sp = progress.structuringProgress;
      if (!sp) {
        return (
          <>
            <div className="text-foreground-muted mb-1.5">
              Building Plex structure…
            </div>
            <div className="h-1 bg-background-tertiary rounded-full overflow-hidden mb-1.5 relative">
              <div className="absolute inset-0 h-full w-1/3 bg-accent rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]" />
            </div>
          </>
        );
      }
      const pct =
        sp.totalFiles > 0
          ? Math.round((sp.filesStructured / sp.totalFiles) * 100)
          : 0;
      return (
        <>
          <div className="text-foreground-muted mb-1.5 tabular-nums">
            {sp.filesStructured}/{sp.totalFiles} files
          </div>
          <div className="h-1 bg-background-tertiary rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      );
    }

    case "awaiting_finalize":
      return (
        <div className="text-foreground-muted mb-1.5">
          {progress.resolvedCoreEpisodeCount} episodes ready
        </div>
      );

    case "finalizing": {
      const op = progress.outputProgress;
      if (!op) {
        return (
          <>
            <div className="text-foreground-muted mb-1.5">
              Moving to library…
            </div>
            <div className="h-1 bg-background-tertiary rounded-full overflow-hidden mb-1.5 relative">
              <div className="absolute inset-0 h-full w-1/3 bg-accent rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]" />
            </div>
          </>
        );
      }
      const pct =
        op.totalFiles > 0
          ? Math.round((op.filesCopied / op.totalFiles) * 100)
          : 0;
      return (
        <>
          <div className="text-foreground-muted mb-1.5 tabular-nums">
            {op.filesCopied}/{op.totalFiles} files
          </div>
          <div className="h-1 bg-background-tertiary rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      );
    }

    case "completed":
      return (
        <div className="text-emerald-400 mb-1.5">
          {progress.resolvedCoreEpisodeCount} episodes organized
        </div>
      );

    case "failed":
      return (
        <div className="text-red-400 mb-1.5">Workflow failed</div>
      );

    default:
      return null;
  }
}
