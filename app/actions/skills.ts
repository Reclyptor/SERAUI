"use server";

import { seraFetch } from "./_client";

export interface SkillListItem {
  name: string;
  description: string;
  status: "active" | "stale" | "archived";
  allowedTools: string[];
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillFile {
  path: string;
  content: string;
}

export interface SkillDetail {
  name: string;
  description: string;
  content: string;
  license?: string;
  compatibility?: string;
  allowedTools: string[];
  metadata: Record<string, unknown>;
  files: SkillFile[];
  seedHash?: string;
  origin?: "seed" | "agent" | "user";
  absorbedInto?: string;
  status: "active" | "stale" | "archived";
  lastUsedAt?: string;
  usageCount: number;
  curatorNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export async function listSkills(): Promise<SkillListItem[]> {
  return seraFetch<SkillListItem[]>("/skills", {
    errorContext: "Failed to fetch skills",
  });
}

export async function getSkill(name: string): Promise<SkillDetail> {
  return seraFetch<SkillDetail>(`/skills/${encodeURIComponent(name)}`, {
    errorContext: "Failed to fetch skill",
  });
}

export async function saveSkill(
  name: string,
  data: {
    content?: string;
    description?: string;
    allowedTools?: string[];
    metadata?: Record<string, unknown>;
  },
): Promise<SkillDetail> {
  return seraFetch<SkillDetail>(`/skills/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: data,
    errorContext: "Failed to save skill",
  });
}
