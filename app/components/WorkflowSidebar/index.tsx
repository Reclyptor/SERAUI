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
} from "lucide-react";
import { useWorkflows } from "../../contexts/WorkflowContext";
import {
  listSeriesRoots,
  startThreadWorkflow,
  finalizeThreadWorkflow,
  type SeriesRoot,
} from "@/app/actions/media";

interface WorkflowSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chatID: string | null;
}

export function WorkflowSidebar({
  isOpen,
  onClose,
  chatID,
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

  // Fetch series roots when sidebar opens
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingRoots(true);
    listSeriesRoots()
      .then((roots) => setSeriesRoots(roots))
      .catch(() => setSeriesRoots([]))
      .finally(() => setIsLoadingRoots(false));
  }, [isOpen]);

  // Determine which series paths already have active (non-terminal) workflows
  const activeSeriesPaths = useMemo(() => {
    const paths = new Set<string>();
    for (const wf of activeWorkflows) {
      if (wf.status === "running" || wf.status === "unknown") {
        const selectedRoot = wf.progress?.selectedSeriesRoot;
        if (selectedRoot) paths.add(selectedRoot);
      }
    }
    return paths;
  }, [activeWorkflows]);

  // Filter series by search query
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
    [chatID, startingWorkflows],
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
              const isActive = activeSeriesPaths.has(root.path);
              const isStarting = startingWorkflows.has(root.path);
              const isDisabled = isActive || isStarting || !chatID;

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
                    {isActive && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                        Running
                      </span>
                    )}
                    {isStarting && (
                      <Loader2 className="w-3 h-3 shrink-0 text-foreground-muted animate-spin" />
                    )}
                    {!isActive && !isStarting && (
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

function WorkflowCard({
  workflow,
  threadId,
  onCancel,
}: {
  workflow: {
    workflowId: string;
    status: string;
    progress: {
      totalFolders: number;
      foldersCompleted: number;
      foldersFailed: number;
      workflowStage: string;
      expectedCoreEpisodeCount: number;
      resolvedCoreEpisodeCount: number;
      canFinalize: boolean;
      awaitingFinalApproval: boolean;
    } | null;
  };
  threadId: string | null;
  onCancel: () => void;
}) {
  const { progress, status } = workflow;
  const isRunning = status === "running" || status === "unknown";
  const isTerminal =
    status === "completed" || status === "failed" || status === "canceled";

  const percentage =
    progress && progress.totalFolders > 0
      ? Math.round(
          ((progress.foldersCompleted + progress.foldersFailed) /
            progress.totalFolders) *
            100,
        )
      : 0;

  const stageLabel = progress?.workflowStage
    ? progress.workflowStage.replaceAll("_", " ")
    : status;

  const StatusIcon = isTerminal
    ? status === "completed"
      ? CheckCircle2
      : status === "failed"
        ? XCircle
        : XCircle
    : progress?.workflowStage === "awaiting_review" ||
        progress?.workflowStage === "awaiting_finalize"
      ? AlertTriangle
      : Loader2;

  const iconColor = isTerminal
    ? status === "completed"
      ? "text-emerald-400"
      : "text-foreground-muted"
    : "text-accent";

  return (
    <div className="rounded-lg border border-border px-3 py-2 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <StatusIcon
          className={clsx(
            "w-3 h-3 shrink-0",
            iconColor,
            isRunning &&
              progress?.workflowStage !== "awaiting_review" &&
              progress?.workflowStage !== "awaiting_finalize" &&
              "animate-spin",
          )}
        />
        <span className="text-foreground truncate capitalize">
          {stageLabel}
        </span>
      </div>

      {progress && (
        <>
          <div className="flex items-center gap-2 text-foreground-muted mb-1.5">
            <span className="tabular-nums">
              {progress.foldersCompleted}/{progress.totalFolders} folders
            </span>
            <span className="tabular-nums">
              {progress.resolvedCoreEpisodeCount}/
              {progress.expectedCoreEpisodeCount} episodes
            </span>
          </div>
          <div className="h-1 bg-background-tertiary rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-2">
        {isRunning && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] px-2 py-0.5 rounded border border-border text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
          >
            Cancel
          </button>
        )}
        {progress?.canFinalize && progress?.awaitingFinalApproval && threadId && (
          <button
            type="button"
            onClick={() =>
              void finalizeThreadWorkflow(threadId, workflow.workflowId)
            }
            className="text-[10px] px-2 py-0.5 rounded border border-accent/50 text-accent hover:bg-accent/10"
          >
            Finalize
          </button>
        )}
      </div>
    </div>
  );
}
