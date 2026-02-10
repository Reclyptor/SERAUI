"use client";

import { useMemo } from "react";
import clsx from "clsx";
import {
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useWorkflows, type ActiveWorkflow } from "../../contexts/WorkflowContext";

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Loader2; label: string; color: string }
> = {
  pending: { icon: Clock, label: "Pending", color: "text-foreground-muted" },
  scanning: { icon: Loader2, label: "Scanning", color: "text-accent" },
  extracting: { icon: Loader2, label: "Extracting", color: "text-accent" },
  matching: { icon: Loader2, label: "Matching", color: "text-accent" },
  renaming: { icon: Loader2, label: "Renaming", color: "text-accent" },
  awaiting_review: {
    icon: AlertTriangle,
    label: "Needs Review",
    color: "text-amber-400",
  },
  moving: { icon: Loader2, label: "Moving", color: "text-accent" },
  completed: {
    icon: CheckCircle2,
    label: "Done",
    color: "text-emerald-400",
  },
  failed: { icon: XCircle, label: "Failed", color: "text-red-400" },
};

function FolderStatusRow({
  folderName,
  status,
}: {
  folderName: string;
  status: string;
}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;
  const isAnimated =
    status === "scanning" ||
    status === "extracting" ||
    status === "matching" ||
    status === "renaming" ||
    status === "moving";

  return (
    <div className="flex items-center justify-between py-1 px-1 text-xs">
      <span className="text-foreground truncate max-w-[200px]">
        {folderName}
      </span>
      <span className={clsx("flex items-center gap-1.5 shrink-0", config.color)}>
        <Icon
          className={clsx("w-3 h-3", isAnimated && "animate-spin")}
        />
        <span>{config.label}</span>
      </span>
    </div>
  );
}

function WorkflowSummary({ workflow }: { workflow: ActiveWorkflow }) {
  const { progress } = workflow;
  if (!progress) return null;

  const { totalFolders, foldersCompleted, foldersFailed, foldersPendingReview } =
    progress;

  const percentage =
    totalFolders > 0
      ? Math.round(((foldersCompleted + foldersFailed) / totalFolders) * 100)
      : 0;

  return (
    <div className="flex items-center gap-3 text-xs text-foreground-muted">
      <span className="text-foreground font-medium">Organizing library</span>
      <span className="tabular-nums">
        {foldersCompleted}/{totalFolders} folders
      </span>
      {foldersFailed > 0 && (
        <span className="text-red-400 tabular-nums">
          {foldersFailed} failed
        </span>
      )}
      {foldersPendingReview > 0 && (
        <span className="text-amber-400 tabular-nums">
          {foldersPendingReview} reviews
        </span>
      )}
      <div className="flex-1 h-1 bg-background-tertiary rounded-full overflow-hidden min-w-[60px] max-w-[120px]">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="tabular-nums">{percentage}%</span>
    </div>
  );
}

export function WorkflowBanner() {
  const {
    activeWorkflows,
    hasActiveWorkflows,
    isBannerExpanded,
    toggleBanner,
    clearTerminalWorkflows,
  } = useWorkflows();

  const workflowsWithProgress = useMemo(
    () => activeWorkflows.filter((workflow) => workflow.progress !== null),
    [activeWorkflows],
  );

  // Collect all folder statuses for expanded view
  const folderStatuses = useMemo(() => {
    const statuses: Array<{ folderName: string; status: string }> = [];
    for (const workflow of workflowsWithProgress) {
      if (workflow.progress?.folderStatuses) {
        for (const [name, status] of Object.entries(
          workflow.progress.folderStatuses,
        )) {
          statuses.push({ folderName: name, status });
        }
      }
    }
    // Sort: awaiting_review first, then in-progress, then pending, then done
    const order: Record<string, number> = {
      awaiting_review: 0,
      scanning: 1,
      extracting: 1,
      matching: 1,
      renaming: 1,
      moving: 1,
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
    return workflowsWithProgress.some((workflow) => {
      if (!workflow.progress?.folderStatuses) return false;
      return Object.values(workflow.progress.folderStatuses).some((status) =>
        ["pending", "scanning", "extracting", "matching", "renaming", "moving"].includes(status),
      );
    });
  }, [workflowsWithProgress]);

  const terminalWorkflowCount = useMemo(
    () => activeWorkflows.filter((workflow) => workflow.status !== "running").length,
    [activeWorkflows],
  );

  if (!hasActiveWorkflows || workflowsWithProgress.length === 0) return null;

  const SummaryIcon = hasInProgressWork ? Loader2 : CheckCircle2;

  return (
    <div className="w-full max-w-[672px] mx-auto px-4">
      <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
        {/* Summary bar */}
        <div className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-background-tertiary/50 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <SummaryIcon
              className={clsx(
                "w-3.5 h-3.5 shrink-0",
                hasInProgressWork ? "text-accent animate-spin" : "text-emerald-400",
              )}
            />
            {workflowsWithProgress.map((workflow) => (
              <WorkflowSummary key={workflow.workflowId} workflow={workflow} />
            ))}
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
                isBannerExpanded ? "Collapse workflow details" : "Expand workflow details"
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

        {/* Expanded folder list */}
        <div
          className={clsx(
            "grid transition-[grid-template-rows] duration-200 ease-in-out",
            isBannerExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-border px-3 py-2 max-h-[200px] overflow-y-auto">
              {folderStatuses.length === 0 ? (
                <div className="text-xs text-foreground-muted py-2 text-center">
                  Scanning directories...
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
  );
}
