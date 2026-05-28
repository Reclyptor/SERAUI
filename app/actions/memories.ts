"use server";

import { seraFetch } from "./_client";

export interface MemoryEntry {
  id: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function listMemories(): Promise<MemoryEntry[]> {
  return seraFetch<MemoryEntry[]>("/memories", {
    errorContext: "Failed to fetch memories",
  });
}

export async function deleteMemory(id: string): Promise<void> {
  await seraFetch<void>(`/memories/${encodeURIComponent(id)}`, {
    method: "DELETE",
    errorContext: "Failed to delete memory",
  });
}
