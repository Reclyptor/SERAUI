"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.SERA_API_URL ?? "http://localhost:3001";
const API_PREFIX = "/api/v1";

// ============================================
// Types
// ============================================

export interface WorkflowDescription {
  workflowId: string;
  status: string;
  startTime: string;
  closeTime: string | null;
  taskQueue: string;
}

export interface OrganizeLibraryProgress {
  totalFolders: number;
  foldersCompleted: number;
  foldersFailed: number;
  foldersInProgress: number;
  foldersPendingReview: number;
  folderStatuses: Record<string, string>;
}

export interface AnimeEpisode {
  number: number;
  title: string | null;
  description: string | null;
}

export interface ReviewItem {
  id: string;
  fileName: string;
  filePath: string;
  subtitleSnippet: string;
  suggestedEpisodeNumber: number;
  suggestedEpisodeTitle: string;
  confidence: number;
  reasoning: string;
  availableEpisodes: AnimeEpisode[];
}

export interface ProcessFolderProgress {
  folderName: string;
  status: string;
  totalFiles: number;
  filesProcessed: number;
  pendingReviews: ReviewItem[];
}

export interface PersistedWorkflowState {
  workflowId: string;
  status: "running" | "completed" | "failed" | "unknown" | "canceled";
  progress: Record<string, unknown> | null;
  pendingReviewWorkflows: string[];
  startedAt: string;
  lastSyncedAt: string;
}

export interface ReviewDecision {
  reviewItemId: string;
  approved: boolean;
  correctedEpisodeNumber?: number;
}

// ============================================
// Helpers
// ============================================

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  if (allCookies.length === 0) {
    throw new Error("Not authenticated");
  }
  return allCookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function fetchWithAuth(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    ...options,
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.message || `Request failed: ${response.statusText}`,
    );
  }

  return response;
}

// ============================================
// Server Actions
// ============================================

/**
 * Get the description (status, start time, etc.) of a workflow.
 */
export async function getWorkflowDescription(
  workflowId: string,
): Promise<WorkflowDescription> {
  const response = await fetchWithAuth(`/workflows/${workflowId}`);
  return response.json();
}

/**
 * Get progress for an organize-library parent workflow.
 */
export async function getWorkflowProgress(
  workflowId: string,
): Promise<OrganizeLibraryProgress> {
  const response = await fetchWithAuth(`/workflows/${workflowId}/progress`);
  return response.json();
}

/**
 * Get progress for a process-folder child workflow.
 */
export async function getFolderProgress(
  workflowId: string,
): Promise<ProcessFolderProgress> {
  const response = await fetchWithAuth(`/workflows/folder/${workflowId}/progress`);
  return response.json();
}

/**
 * Get pending review items for a process-folder child workflow.
 */
export async function getPendingReviews(
  workflowId: string,
): Promise<ReviewItem[]> {
  const response = await fetchWithAuth(`/workflows/folder/${workflowId}/reviews`);
  return response.json();
}

/**
 * Submit a review decision for a pending episode match.
 */
export async function submitReviewDecision(
  workflowId: string,
  decision: ReviewDecision,
): Promise<{ success: boolean }> {
  const response = await fetchWithAuth(`/workflows/folder/${workflowId}/reviews`, {
    method: "POST",
    body: JSON.stringify(decision),
  });
  return response.json();
}

/**
 * Get persisted workflow state for a chat thread.
 */
export async function getThreadWorkflowState(
  threadId: string,
): Promise<PersistedWorkflowState[]> {
  const response = await fetchWithAuth(`/workflows/thread/${threadId}/state`);
  return response.json();
}

/**
 * Cancel a tracked workflow in a given chat thread.
 */
export async function cancelThreadWorkflow(
  threadId: string,
  workflowId: string,
): Promise<{ success: boolean }> {
  const response = await fetchWithAuth(`/workflows/thread/${threadId}/${workflowId}/cancel`, {
    method: "POST",
  });
  return response.json();
}
