"use server";

import { seraFetch } from "./_client";

export interface PromptListItem {
  slug: string;
  extends?: string;
  seedHash?: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PromptDetail {
  slug: string;
  extends?: string;
  seedHash?: string;
  content: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export async function listPrompts(): Promise<PromptListItem[]> {
  return seraFetch<PromptListItem[]>("/prompts", {
    errorContext: "Failed to fetch prompts",
  });
}

export async function getPrompt(slug: string): Promise<PromptDetail> {
  return seraFetch<PromptDetail>(`/prompts/${encodeURIComponent(slug)}`, {
    errorContext: "Failed to fetch prompt",
  });
}

export async function savePrompt(
  slug: string,
  data: {
    content: string;
    extends?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<PromptDetail> {
  return seraFetch<PromptDetail>(`/prompts/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: data,
    errorContext: "Failed to save prompt",
  });
}
