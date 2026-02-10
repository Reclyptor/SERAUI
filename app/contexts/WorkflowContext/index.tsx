"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  getWorkflowProgress,
  getWorkflowDescription,
  type OrganizeLibraryProgress,
  type ReviewItem,
  type WorkflowDescription,
} from "@/app/actions/media";

// ============================================
// Types
// ============================================

export interface ActiveWorkflow {
  workflowId: string;
  status: "running" | "completed" | "failed" | "unknown";
  progress: OrganizeLibraryProgress | null;
  startedAt: Date;
  /** Folder workflow IDs that have pending reviews */
  pendingReviewWorkflows: string[];
}

interface WorkflowContextValue {
  /** Currently tracked workflows */
  activeWorkflows: ActiveWorkflow[];
  /** Add a workflow to track by ID */
  trackWorkflow: (workflowId: string) => void;
  /** Remove a workflow from tracking */
  untrackWorkflow: (workflowId: string) => void;
  /** Whether any workflows are currently active */
  hasActiveWorkflows: boolean;
  /** Total pending review count across all workflows */
  totalPendingReviews: number;
  /** Whether the banner is expanded */
  isBannerExpanded: boolean;
  /** Toggle banner expansion */
  toggleBanner: () => void;
}

// ============================================
// Context
// ============================================

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

const POLL_INTERVAL_MS = 5000;

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>([]);
  const [isBannerExpanded, setIsBannerExpanded] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const trackWorkflow = useCallback((workflowId: string) => {
    setActiveWorkflows((prev) => {
      // Don't add duplicates
      if (prev.some((w) => w.workflowId === workflowId)) return prev;
      return [
        ...prev,
        {
          workflowId,
          status: "running",
          progress: null,
          startedAt: new Date(),
          pendingReviewWorkflows: [],
        },
      ];
    });
  }, []);

  const untrackWorkflow = useCallback((workflowId: string) => {
    setActiveWorkflows((prev) =>
      prev.filter((w) => w.workflowId !== workflowId),
    );
  }, []);

  const toggleBanner = useCallback(() => {
    setIsBannerExpanded((prev) => !prev);
  }, []);

  // Poll active workflows for progress
  const pollWorkflows = useCallback(async () => {
    setActiveWorkflows((prev) => {
      // Only poll if there are active workflows
      const running = prev.filter(
        (w) => w.status === "running" || w.status === "unknown",
      );
      if (running.length === 0) return prev;

      // Trigger async updates
      for (const workflow of running) {
        pollSingleWorkflow(workflow.workflowId).then((update) => {
          if (update) {
            setActiveWorkflows((current) =>
              current.map((w) =>
                w.workflowId === update.workflowId
                  ? { ...w, ...update }
                  : w,
              ),
            );
          }
        });
      }

      return prev;
    });
  }, []);

  // Start/stop polling based on active workflows
  useEffect(() => {
    const hasRunning = activeWorkflows.some(
      (w) => w.status === "running" || w.status === "unknown",
    );

    if (hasRunning && !pollIntervalRef.current) {
      // Poll immediately, then on interval
      pollWorkflows();
      pollIntervalRef.current = setInterval(pollWorkflows, POLL_INTERVAL_MS);
    } else if (!hasRunning && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeWorkflows, pollWorkflows]);

  const hasActiveWorkflows = activeWorkflows.length > 0;
  const totalPendingReviews = activeWorkflows.reduce(
    (sum, w) => sum + (w.progress?.foldersPendingReview ?? 0),
    0,
  );

  return (
    <WorkflowContext.Provider
      value={{
        activeWorkflows,
        trackWorkflow,
        untrackWorkflow,
        hasActiveWorkflows,
        totalPendingReviews,
        isBannerExpanded,
        toggleBanner,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflows() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflows must be used within a WorkflowProvider");
  }
  return context;
}

// ============================================
// Polling Helper
// ============================================

async function pollSingleWorkflow(
  workflowId: string,
): Promise<Partial<ActiveWorkflow> & { workflowId: string } | null> {
  try {
    // First check if the workflow is still running
    const description = await getWorkflowDescription(workflowId);
    const isRunning = description.status === "RUNNING";

    // Get progress data
    const progress = await getWorkflowProgress(workflowId);

    // Find folders with pending reviews
    const pendingReviewWorkflows = Object.entries(
      progress.folderStatuses,
    )
      .filter(([, status]) => status === "awaiting_review")
      .map(
        ([folderName]) => `process-folder-${sanitizeWorkflowId(folderName)}`,
      );

    return {
      workflowId,
      status: isRunning
        ? "running"
        : description.status === "COMPLETED"
          ? "completed"
          : "failed",
      progress,
      pendingReviewWorkflows,
    };
  } catch {
    // Workflow may have been terminated or not found
    return {
      workflowId,
      status: "unknown",
    };
  }
}

function sanitizeWorkflowId(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 200);
}
