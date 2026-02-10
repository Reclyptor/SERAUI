"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { type OrganizeLibraryProgress } from "@/app/actions/media";

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

export interface PersistedWorkflowState {
  workflowId: string;
  status: "running" | "completed" | "failed" | "unknown";
  progress: Record<string, unknown> | null;
  pendingReviewWorkflows: string[];
  startedAt: string | Date;
  lastSyncedAt: string | Date;
}

interface WorkflowContextValue {
  /** Currently tracked workflows */
  activeWorkflows: ActiveWorkflow[];
  /** Add a workflow to track by ID */
  trackWorkflow: (workflowId: string) => void;
  /** Remove a workflow from tracking */
  untrackWorkflow: (workflowId: string) => void;
  /** Remove workflows that are no longer running */
  clearTerminalWorkflows: () => void;
  /** Restore workflows from persisted snapshot */
  restoreWorkflows: (workflows: PersistedWorkflowState[]) => void;
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

const WORKFLOW_WS_NAMESPACE = "/media-workflows";

interface WorkflowUpdateEvent {
  workflowId: string;
  status: "running" | "completed" | "failed" | "unknown";
  progress: OrganizeLibraryProgress | null;
  pendingReviewWorkflows: string[];
  lastSyncedAt: string;
}

function getWorkflowSocketUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SERA_WS_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const apiBase =
    process.env.NEXT_PUBLIC_SERA_API_URL?.trim() || "http://localhost:3001";
  return apiBase.replace(/\/+$/, "");
}

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>([]);
  const [isBannerExpanded, setIsBannerExpanded] = useState(false);
  const activeWorkflowsRef = useRef<ActiveWorkflow[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const dismissedWorkflowIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeWorkflowsRef.current = activeWorkflows;
  }, [activeWorkflows]);

  const trackWorkflow = useCallback((workflowId: string) => {
    if (dismissedWorkflowIdsRef.current.has(workflowId)) return;
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
    dismissedWorkflowIdsRef.current.add(workflowId);
    setActiveWorkflows((prev) =>
      prev.filter((w) => w.workflowId !== workflowId),
    );
  }, []);

  const clearTerminalWorkflows = useCallback(() => {
    setActiveWorkflows((prev) => {
      for (const workflow of prev) {
        if (workflow.status !== "running") {
          dismissedWorkflowIdsRef.current.add(workflow.workflowId);
        }
      }
      return prev.filter((w) => w.status === "running");
    });
  }, []);

  const restoreWorkflows = useCallback((workflows: PersistedWorkflowState[]) => {
    if (!workflows || workflows.length === 0) return;
    for (const workflow of workflows) {
      dismissedWorkflowIdsRef.current.delete(workflow.workflowId);
    }
    setActiveWorkflows((prev) => {
      const merged = [...prev];
      for (const persisted of workflows) {
        const idx = merged.findIndex((w) => w.workflowId === persisted.workflowId);
        const restored: ActiveWorkflow = {
          workflowId: persisted.workflowId,
          status: persisted.status,
          progress: (persisted.progress as OrganizeLibraryProgress | null) ?? null,
          pendingReviewWorkflows: persisted.pendingReviewWorkflows ?? [],
          startedAt: new Date(persisted.startedAt),
        };
        if (idx === -1) {
          merged.push(restored);
        } else {
          merged[idx] = { ...merged[idx], ...restored };
        }
      }
      return merged;
    });
  }, []);

  const toggleBanner = useCallback(() => {
    setIsBannerExpanded((prev) => !prev);
  }, []);

  // Keep a websocket open for push-based workflow state updates.
  useEffect(() => {
    const socket = io(getWorkflowSocketUrl() + WORKFLOW_WS_NAMESPACE, {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    const onConnect = () => {
      socket.emit("subscribe_workflows", {
        workflowIds: activeWorkflowsRef.current.map((w) => w.workflowId),
      });
    };
    const onUpdate = (update: WorkflowUpdateEvent) => {
      setActiveWorkflows((prev) => {
        const idx = prev.findIndex((w) => w.workflowId === update.workflowId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status: update.status,
          progress: update.progress,
          pendingReviewWorkflows: update.pendingReviewWorkflows,
        };
        return next;
      });
    };

    socket.on("connect", onConnect);
    socket.on("workflow_update", onUpdate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("workflow_update", onUpdate);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Keep server-side subscription set in sync with workflows tracked by UI.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit("subscribe_workflows", {
      workflowIds: activeWorkflows.map((w) => w.workflowId),
    });
  }, [activeWorkflows]);

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
        clearTerminalWorkflows,
        restoreWorkflows,
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
