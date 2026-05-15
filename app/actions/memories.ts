"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.SERA_API_URL ?? "http://localhost:3001";
const API_PREFIX = "/api/v1";

export interface MemoryEntry {
  id: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  if (allCookies.length === 0) {
    throw new Error("Not authenticated");
  }
  return allCookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function listMemories(): Promise<MemoryEntry[]> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/memories`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch memories: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteMemory(id: string): Promise<void> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/memories/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Cookie: cookieHeader },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete memory: ${response.statusText}`);
  }
}
