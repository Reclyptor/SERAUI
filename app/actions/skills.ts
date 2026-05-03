"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.SERA_API_URL ?? "http://localhost:3001";
const API_PREFIX = "/api/v1";

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
  metadata: Record<string, string>;
  files: SkillFile[];
  status: "active" | "stale" | "archived";
  lastUsedAt?: string;
  usageCount: number;
}

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  if (allCookies.length === 0) {
    throw new Error("Not authenticated");
  }
  return allCookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function listSkills(): Promise<SkillListItem[]> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/skills`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch skills: ${response.statusText}`);
  }

  return response.json();
}

export async function getSkill(name: string): Promise<SkillDetail> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/skills/${encodeURIComponent(name)}`,
    {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch skill: ${response.statusText}`);
  }

  return response.json();
}

export async function saveSkill(
  name: string,
  data: {
    content?: string;
    description?: string;
    allowedTools?: string[];
    metadata?: Record<string, string>;
  },
): Promise<SkillDetail> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/skills/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to save skill: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteSkill(name: string): Promise<void> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/skills/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
      headers: { Cookie: cookieHeader },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete skill: ${response.statusText}`);
  }
}
