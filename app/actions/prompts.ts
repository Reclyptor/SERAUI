"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.SERA_API_URL ?? "http://localhost:3001";
const API_PREFIX = "/api/v1";

export interface PromptListItem {
  slug: string;
  extends?: string;
  description?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PromptDetail {
  slug: string;
  extends?: string;
  content: string;
  description?: string;
  metadata: Record<string, unknown>;
}

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  if (allCookies.length === 0) {
    throw new Error("Not authenticated");
  }
  return allCookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function listPrompts(): Promise<PromptListItem[]> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/prompts`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch prompts: ${response.statusText}`);
  }

  return response.json();
}

export async function getPrompt(slug: string): Promise<PromptDetail> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/prompts/${encodeURIComponent(slug)}`,
    {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch prompt: ${response.statusText}`);
  }

  return response.json();
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
  const cookieHeader = await getCookieHeader();

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/prompts/${encodeURIComponent(slug)}`,
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
    throw new Error(`Failed to save prompt: ${response.statusText}`);
  }

  return response.json();
}

export async function deletePrompt(slug: string): Promise<void> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/prompts/${encodeURIComponent(slug)}`,
    {
      method: "DELETE",
      headers: { Cookie: cookieHeader },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to delete prompt: ${response.statusText}`);
  }
}
