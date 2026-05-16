"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.SERA_API_URL ?? "http://localhost:3001";
const API_PREFIX = "/api/v1";

export interface ActiveHours {
  start: number;
  end: number;
  timezone?: string;
}

export interface HeartbeatConfig {
  agentID: string;
  enabled: boolean;
  intervalMinutes: number;
  activeHours?: ActiveHours;
  checklist: string[];
  maxTokens: number;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeartbeatCreateInput {
  agentID: string;
  intervalMinutes?: number;
  activeHours?: ActiveHours;
  checklist?: string[];
  maxTokens?: number;
  enabled?: boolean;
}

export interface HeartbeatUpdateInput {
  intervalMinutes?: number;
  activeHours?: ActiveHours;
  checklist?: string[];
  maxTokens?: number;
  enabled?: boolean;
}

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  if (allCookies.length === 0) {
    throw new Error("Not authenticated");
  }
  return allCookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function listHeartbeats(): Promise<HeartbeatConfig[]> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/heartbeats`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch heartbeats: ${response.statusText}`);
  }
  return response.json();
}

export async function getHeartbeat(agentID: string): Promise<HeartbeatConfig> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/heartbeats/${encodeURIComponent(agentID)}`,
    { headers: { Cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch heartbeat: ${response.statusText}`);
  }
  return response.json();
}

export async function createHeartbeat(
  input: HeartbeatCreateInput,
): Promise<HeartbeatConfig> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/heartbeats`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to create heartbeat: ${response.statusText}`);
  }
  return response.json();
}

export async function saveHeartbeat(
  agentID: string,
  input: HeartbeatUpdateInput,
): Promise<HeartbeatConfig> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/heartbeats/${encodeURIComponent(agentID)}`,
    {
      method: "PUT",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to save heartbeat: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteHeartbeat(agentID: string): Promise<void> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/heartbeats/${encodeURIComponent(agentID)}`,
    { method: "DELETE", headers: { Cookie: cookieHeader } },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete heartbeat: ${response.statusText}`);
  }
}
