"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  ThumbsDown,
  Search,
  Download,
  FolderOpen,
  Package,
  HardDrive,
} from "lucide-react";
import {
  useWorkflows,
  type ActiveWorkflow,
} from "../../contexts/WorkflowContext";
import { finalizeThreadWorkflow } from "@/app/actions/media";
import type {
  OrganizeLibraryProgress,
  FolderStatus,
} from "@/app/actions/media";
import { StagingTreeModal } from "../StagingTreeModal";

// ── Status config for folder rows ────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Loader2; label: string; color: string }
> = {
  pending: { icon: Clock, label: "Pending", color: "text-foreground-muted" },
  scanning: { icon: Loader2, label: "Scanning", color: "text-accent" },
  extracting: { icon: Loader2, label: "Extracting", color: "text-accent" },
  matching: { icon: Loader2, label: "Matching", color: "text-accent" },
  renaming: { icon: Loader2, label: "Renaming", color: "text-accent" },
  awaiting_detection_review: {
    icon: AlertTriangle,
    label: "Confirm Detection",
    color: "text-amber-400",
  },
  awaiting_review: {
    icon: AlertTriangle,
    label: "Needs Review",
    color: "text-amber-400",
  },
  completed: {
    icon: CheckCircle2,
    label: "Done",
    color: "text-emerald-400",
  },
  canceled: {
    icon: XCircle,
    label: "Canceled",
    color: "text-foreground-muted",
  },
  failed: { icon: XCircle, label: "Failed", color: "text-red-400" },
};

// ── Helper: format bytes ─────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ── Indeterminate progress bar ───────────────────────────────────────

function IndeterminateBar() {
  return (
    <div className="flex-1 h-1 bg-background-tertiary rounded-full overflow-hidden min-w-[60px] max-w-[120px] relative">
      <div className="absolute inset-0 h-full w-1/3 bg-accent rounded-full animate-[indeterminate_1.4s_ease-in-out_infinite]" />
    </div>
  );
}

// ── Determinate progress bar ─────────────────────────────────────────

function DeterminateBar({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <>
      <div className="flex-1 h-1 bg-background-tertiary rounded-full overflow-hidden min-w-[60px] max-w-[120px]">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums">{pct}%</span>
    </>
  );
}

// ── Folder status row ────────────────────────────────────────────────

function FolderStatusRow({
  folderName,
  status,
}: {
  folderName: string;
  status: FolderStatus;
}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;
  const isAnimated =
    status === "scanning" ||
    status === "extracting" ||
    status === "matching" ||
    status === "renaming";

  return (
    <div className="flex items-center justify-between py-1 px-1 text-xs">
      <span className="text-foreground truncate max-w-[200px]">
        {folderName}
      </span>
      <span
        className={clsx(
          "flex items-center gap-1.5 shrink-0",
          config.color,
        )}
      >
        <Icon className={clsx("w-3 h-3", isAnimated && "animate-spin")} />
        <span>{config.label}</span>
      </span>
    </div>
  );
}

// ── Stage-specific summary component ─────────────────────────────────

function WorkflowSummary({ workflow }: { workflow: ActiveWorkflow }) {
  const { progress } = workflow;
  if (!progress) return null;

  const p = progress as OrganizeLibraryProgress;
  const stage = p.workflowStage ?? "copying";

  switch (stage) {
    // ── Stage 1: Copying ──
    case "copying": {
      const cp = p.copyProgress;
      if (!cp) {
        return (
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <Download className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-foreground font-medium">
              Copying files to processing…
            </span>
            <IndeterminateBar />
          </div>
        );
      }
      return (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <Download className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-foreground font-medium">Copying files</span>
          <span className="tabular-nums">
            {cp.filesCopied}/{cp.totalFiles}
          </span>
          {cp.currentFiles.length > 0 && (
            <span className="truncate max-w-[180px]">
              {cp.currentFiles.length > 1
                ? `${cp.currentFiles.length} active`
                : cp.currentFiles[0]}
            </span>
          )}
          <DeterminateBar value={cp.filesCopied} max={cp.totalFiles} />
        </div>
      );
    }

    // ── Stage 2: Fetching Metadata ──
    case "fetching_metadata": {
      const meta = p.metadataSummary;
      const label = meta
        ? meta.status === "searching"
          ? "Searching AniList…"
          : meta.status === "found"
            ? `Found: ${meta.seriesName}`
            : meta.status === "traversing"
              ? `Traversing seasons… (${meta.seasonCount ?? "?"})`
              : meta.status === "fetching_episodes"
                ? `Fetching episodes for ${meta.seasons?.length ?? 0}/${meta.seasonCount ?? "?"} seasons`
                : `${meta.seasonCount} seasons, ${meta.totalEpisodes} episodes`
        : "Fetching metadata…";

      return (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <Search className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-foreground font-medium">Metadata</span>
          <span>{label}</span>
          {meta?.status !== "complete" && <IndeterminateBar />}
        </div>
      );
    }

    // ── Stage 3: Processing Folders ──
    case "processing_folders": {
      const total = p.totalFolders;
      const done = p.foldersCompleted + p.foldersFailed;

      return (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <FolderOpen className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-foreground font-medium">
            Processing folders
          </span>
          <span className="tabular-nums">
            {done}/{total} folders
          </span>
          {p.foldersFailed > 0 && (
            <span className="text-red-400 tabular-nums">
              {p.foldersFailed} failed
            </span>
          )}
          {p.foldersPendingReview > 0 && (
            <span className="text-amber-400 tabular-nums">
              {p.foldersPendingReview} reviews
            </span>
          )}
          <span className="tabular-nums">
            episodes {p.resolvedCoreEpisodeCount}/
            {p.expectedCoreEpisodeCount}
          </span>
          <DeterminateBar value={done} max={total} />
        </div>
      );
    }

    // ── Stage 4: Structuring ──
    case "structuring": {
      const sp = p.structuringProgress;
      if (!sp) {
        return (
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <Package className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-foreground font-medium">
              Building Plex structure…
            </span>
            <IndeterminateBar />
          </div>
        );
      }
      return (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <Package className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-foreground font-medium">Structuring</span>
          <span className="tabular-nums">
            {sp.filesStructured}/{sp.totalFiles}
          </span>
          {sp.currentFile && (
            <span className="truncate max-w-[180px]">{sp.currentFile}</span>
          )}
          <DeterminateBar
            value={sp.filesStructured}
            max={sp.totalFiles}
          />
        </div>
      );
    }

    // ── Stage 5: Awaiting Finalize ──
    case "awaiting_finalize": {
      return (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <Eye className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-foreground font-medium">Ready for review</span>
          <span className="tabular-nums">
            {p.resolvedCoreEpisodeCount} episodes
          </span>
        </div>
      );
    }

    // ── Stage 6: Finalizing ──
    case "finalizing": {
      const op = p.outputProgress;
      if (!op) {
        return (
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <HardDrive className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-foreground font-medium">
              Moving to library…
            </span>
            <IndeterminateBar />
          </div>
        );
      }
      return (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <HardDrive className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="text-foreground font-medium">Finalizing</span>
          <span className="tabular-nums">
            {op.filesCopied}/{op.totalFiles}
          </span>
          {op.currentFiles.length > 0 && (
            <span className="truncate max-w-[180px]">
              {op.currentFiles.length > 1
                ? `${op.currentFiles.length} active`
                : op.currentFiles[0]}
            </span>
          )}
          <DeterminateBar value={op.filesCopied} max={op.totalFiles} />
        </div>
      );
    }

    // ── Terminal states ──
    case "completed":
      return (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-foreground font-medium">Completed</span>
          <span className="tabular-nums">
            {p.resolvedCoreEpisodeCount} episodes organized
          </span>
        </div>
      );
    case "failed":
      return (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-foreground font-medium">Failed</span>
        </div>
      );
    case "canceled":
      return (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <XCircle className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
          <span className="text-foreground font-medium">Canceled</span>
        </div>
      );
    default:
      return null;
  }
}

// ── Expanded detail section ──────────────────────────────────────────

function StageDetailSection({
  progress,
}: {
  progress: OrganizeLibraryProgress;
}) {
  const stage = progress.workflowStage;
  const details: string[] = [];

  // Accumulated metadata summary
  const meta = progress.metadataSummary;
  if (meta && meta.status === "complete" && meta.seasons) {
    details.push(
      `Metadata: ${meta.seriesName} — ${meta.seasonCount} season(s), ${meta.totalEpisodes} episodes`,
    );
    for (const s of meta.seasons) {
      details.push(`  Season ${s.seasonNumber}: ${s.title} (${s.episodeCount} ep)`);
    }
  }

  // Copy progress summary (if completed)
  const cp = progress.copyProgress;
  if (cp && cp.filesCopied === cp.totalFiles && cp.totalFiles > 0) {
    details.push(
      `Copied ${cp.totalFiles} files (${formatBytes(cp.totalBytes)}) to processing`,
    );
  }

  if (details.length === 0 && stage === "copying") {
    return (
      <div className="text-xs text-foreground-muted py-2 text-center">
        Copying series into processing area — folder list will appear once
        copy finishes…
      </div>
    );
  }

  if (details.length === 0 && stage === "fetching_metadata") {
    return (
      <div className="text-xs text-foreground-muted py-2 text-center">
        Fetching series metadata and scanning disc structure…
      </div>
    );
  }

  if (details.length === 0) return null;

  return (
    <div className="text-xs text-foreground-muted py-1 space-y-0.5">
      {details.map((line, i) => (
        <div key={i} className="px-1 whitespace-pre-wrap">
          {line}
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function WorkflowBanner() {
  const {
    activeWorkflows,
    currentThreadId,
    hasActiveWorkflows,
    isBannerExpanded,
    toggleBanner,
    cancelWorkflow,
    clearTerminalWorkflows,
  } = useWorkflows();

  const [reviewingWorkflowId, setReviewingWorkflowId] = useState<
    string | null
  >(null);

  const workflowsWithProgress = useMemo(
    () => activeWorkflows.filter((workflow) => workflow.progress !== null),
    [activeWorkflows],
  );

  const folderStatuses = useMemo(() => {
    const statuses: Array<{ folderName: string; status: FolderStatus }> = [];
    for (const workflow of workflowsWithProgress) {
      if (workflow.progress?.folderStatuses) {
        for (const [name, status] of Object.entries(
          workflow.progress.folderStatuses,
        )) {
          statuses.push({ folderName: name, status: status as FolderStatus });
        }
      }
    }
    const order: Record<string, number> = {
      awaiting_detection_review: 0,
      awaiting_review: 0,
      scanning: 1,
      extracting: 1,
      matching: 1,
      renaming: 1,
      pending: 2,
      completed: 3,
      failed: 3,
    };
    statuses.sort(
      (a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2),
    );
    return statuses;
  }, [workflowsWithProgress]);

  const hasInProgressWork = useMemo(() => {
    return activeWorkflows.some(
      (w) => w.status === "running" || w.status === "unknown",
    );
  }, [activeWorkflows]);

  const terminalWorkflowCount = useMemo(
    () =>
      activeWorkflows.filter(
        (w) =>
          w.status === "completed" ||
          w.status === "failed" ||
          w.status === "canceled",
      ).length,
    [activeWorkflows],
  );

  const cancellableWorkflows = useMemo(
    () =>
      activeWorkflows.filter(
        (w) => w.status === "running" || w.status === "unknown",
      ),
    [activeWorkflows],
  );

  const finalizableWorkflows = useMemo(
    () =>
      activeWorkflows.filter(
        (w) =>
          w.status === "running" &&
          w.progress?.canFinalize &&
          w.progress?.awaitingFinalApproval,
      ),
    [activeWorkflows],
  );

  if (!hasActiveWorkflows) return null;

  const SummaryIcon = hasInProgressWork ? Loader2 : CheckCircle2;

  return (
    <>
      <div className="w-full max-w-[672px] mx-auto px-4">
        <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
          {/* Summary bar */}
          <div className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-background-tertiary/50 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <SummaryIcon
                className={clsx(
                  "w-3.5 h-3.5 shrink-0",
                  hasInProgressWork
                    ? "text-accent animate-spin"
                    : "text-emerald-400",
                )}
              />
              {workflowsWithProgress.length > 0 ? (
                workflowsWithProgress.map((workflow) => (
                  <WorkflowSummary
                    key={workflow.workflowId}
                    workflow={workflow}
                  />
                ))
              ) : (
                <span className="text-xs text-foreground-muted">
                  Workflow tracked (waiting for progress updates)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {terminalWorkflowCount > 0 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearTerminalWorkflows();
                  }}
                  className="text-xs px-2 py-1 rounded-md border border-border text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
                >
                  Clear done
                </button>
              )}
              <button
                type="button"
                onClick={toggleBanner}
                className="p-1 rounded-md hover:bg-background-tertiary"
                aria-label={
                  isBannerExpanded
                    ? "Collapse workflow details"
                    : "Expand workflow details"
                }
              >
                <ChevronUp
                  className={clsx(
                    "w-4 h-4 text-foreground-muted transition-transform duration-200",
                    isBannerExpanded ? "rotate-0" : "rotate-180",
                  )}
                />
              </button>
            </div>
          </div>

          {/* Expanded detail panel */}
          <div
            className={clsx(
              "grid transition-[grid-template-rows] duration-200 ease-in-out",
              isBannerExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="border-t border-border px-3 py-2 max-h-[280px] overflow-y-auto">
                {/* Cancel buttons */}
                {cancellableWorkflows.length > 0 && (
                  <div className="space-y-1 mb-2 pb-2 border-b border-border">
                    {cancellableWorkflows.map((workflow) => (
                      <div
                        key={workflow.workflowId}
                        className="flex items-center justify-between text-xs px-1 py-1"
                      >
                        <span className="text-foreground-muted truncate max-w-[240px]">
                          {workflow.workflowId}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            cancelWorkflow(workflow.workflowId)
                          }
                          className="px-2 py-0.5 rounded border border-border text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Finalize / Reject buttons */}
                {finalizableWorkflows.length > 0 && (
                  <div className="space-y-1 mb-2 pb-2 border-b border-border">
                    {finalizableWorkflows.map((workflow) => (
                      <div
                        key={`finalize-${workflow.workflowId}`}
                        className="flex items-center justify-between text-xs px-1 py-1"
                      >
                        <span className="text-foreground-muted truncate max-w-[140px]">
                          Ready to finalize
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setReviewingWorkflowId(workflow.workflowId)
                            }
                            className="px-2 py-0.5 rounded border border-border text-foreground-muted hover:text-foreground hover:bg-background-tertiary flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Review
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!currentThreadId) return;
                              void finalizeThreadWorkflow(
                                currentThreadId,
                                workflow.workflowId,
                                false,
                              );
                            }}
                            className="px-2 py-0.5 rounded border border-red-400/50 text-red-400 hover:bg-red-400/10 flex items-center gap-1"
                          >
                            <ThumbsDown className="w-3 h-3" />
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!currentThreadId) return;
                              void finalizeThreadWorkflow(
                                currentThreadId,
                                workflow.workflowId,
                                true,
                              );
                            }}
                            className="px-2 py-0.5 rounded border border-accent/50 text-accent hover:bg-accent/10"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stage detail summaries */}
                {workflowsWithProgress.map((w) =>
                  w.progress ? (
                    <StageDetailSection
                      key={`detail-${w.workflowId}`}
                      progress={w.progress}
                    />
                  ) : null,
                )}

                {/* Folder status rows */}
                {folderStatuses.length === 0 ? (
                  <div className="text-xs text-foreground-muted py-2 text-center">
                    {workflowsWithProgress.some(
                      (w) =>
                        w.progress?.workflowStage === "copying" ||
                        w.progress?.workflowStage === "fetching_metadata",
                    )
                      ? workflowsWithProgress.find(
                          (w) =>
                            w.progress?.workflowStage === "copying",
                        )
                        ? "Copying series into processing area — folder list will appear once the copy finishes…"
                        : "Fetching series metadata and scanning disc structure…"
                      : "Waiting for workflow progress updates…"}
                  </div>
                ) : (
                  folderStatuses.map(({ folderName, status }) => (
                    <FolderStatusRow
                      key={folderName}
                      folderName={folderName}
                      status={status}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Staging Tree Review Modal */}
      {reviewingWorkflowId && (
        <StagingTreeModal
          isOpen={true}
          onClose={() => setReviewingWorkflowId(null)}
          workflowId={reviewingWorkflowId}
        />
      )}
    </>
  );
}
