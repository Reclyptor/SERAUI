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
import {
  cancelThreadWorkflow,
  type OrganizeLibraryProgress,
} from "@/app/actions/media";

// ============================================
// Types
// ============================================

export interface ActiveWorkflow {
  workflowId: string;
  status: "running" | "completed" | "failed" | "unknown" | "canceled";
  progress: OrganizeLibraryProgress | null;
  startedAt: Date;
  /** Folder workflow IDs that have pending reviews */
  pendingReviewWorkflows: string[];
}

export interface PersistedWorkflowState {
  workflowId: string;
  status: "running" | "completed" | "failed" | "unknown" | "canceled";
  progress: Record<string, unknown> | null;
  pendingReviewWorkflows: string[];
  startedAt: string | Date;
  lastSyncedAt: string | Date;
}

interface WorkflowContextValue {
  /** Currently tracked workflows */
  activeWorkflows: ActiveWorkflow[];
  /** Bind workflow updates to a specific chat/thread */
  setCurrentThread: (threadId: string | null) => void;
  /** Currently selected chat/thread ID */
  currentThreadId: string | null;
  /** Cancel a specific tracked workflow */
  cancelWorkflow: (workflowId: string) => void;
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

const WORKFLOW_WS_NAMESPACE = "/workflows";

interface WorkflowUpdateEvent {
  threadId: string;
  workflowId: string;
  status: "running" | "completed" | "failed" | "unknown" | "canceled";
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
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentThreadIdRef = useRef<string | null>(null);

  const clearTerminalWorkflows = useCallback(() => {
    setActiveWorkflows((prev) =>
      prev.filter(
        (workflow) =>
          workflow.status === "running" || workflow.status === "unknown",
      ),
    );
  }, []);

  const cancelWorkflow = useCallback((workflowId: string) => {
    const threadId = currentThreadIdRef.current;
    setActiveWorkflows((prev) =>
      prev.map((workflow) =>
        workflow.workflowId === workflowId
          ? { ...workflow, status: "canceled", pendingReviewWorkflows: [] }
          : workflow,
      ),
    );
    if (!threadId) return;
    void cancelThreadWorkflow(threadId, workflowId).catch(() => {
      // Keep optimistic UI state; next backend event will reconcile if needed.
    });
  }, []);

  const restoreWorkflows = useCallback((workflows: PersistedWorkflowState[]) => {
    if (!workflows || workflows.length === 0) return;
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

  const setCurrentThread = useCallback((threadId: string | null) => {
    const previous = currentThreadIdRef.current;
    const next = threadId ?? null;
    const socket = socketRef.current;
    if (socket?.connected && previous && previous !== next) {
      socket.emit("unsubscribe_thread", { threadId: previous });
    }
    currentThreadIdRef.current = next;
    setCurrentThreadId(next);
    if (next === null) {
      setActiveWorkflows([]);
    }
  }, []);

  // Keep a websocket open for push-based workflow state updates.
  useEffect(() => {
    const socket = io(getWorkflowSocketUrl() + WORKFLOW_WS_NAMESPACE, {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    const onConnect = () => {
      const threadId = currentThreadIdRef.current;
      if (!threadId) return;
      socket.emit("subscribe_thread", { threadId });
    };
    const onUpdate = (update: WorkflowUpdateEvent) => {
      const threadId = currentThreadIdRef.current;
      if (!threadId || update.threadId !== threadId) return;

      setActiveWorkflows((prev) => {
        const idx = prev.findIndex((w) => w.workflowId === update.workflowId);
        if (idx === -1) {
          return [
            ...prev,
            {
              workflowId: update.workflowId,
              status: update.status,
              progress: update.progress,
              pendingReviewWorkflows: update.pendingReviewWorkflows,
              startedAt: new Date(update.lastSyncedAt),
            },
          ];
        }
        if (prev[idx].status === "canceled") return prev;
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

  useEffect(() => {
    currentThreadIdRef.current = currentThreadId;
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    if (currentThreadId) {
      socket.emit("subscribe_thread", { threadId: currentThreadId });
    }
  }, [currentThreadId]);

  const hasActiveWorkflows = activeWorkflows.length > 0;
  const totalPendingReviews = activeWorkflows.reduce(
    (sum, w) =>
      w.status === "canceled" ? sum : sum + (w.progress?.foldersPendingReview ?? 0),
    0,
  );

  return (
    <WorkflowContext.Provider
      value={{
        activeWorkflows,
        setCurrentThread,
        currentThreadId,
        cancelWorkflow,
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
