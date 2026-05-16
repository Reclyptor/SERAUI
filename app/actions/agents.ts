"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.SERA_API_URL ?? "http://localhost:3001";
const API_PREFIX = "/api/v1";

export interface ToolPolicy {
  mode: "allow" | "deny";
  tools: string[];
}

export interface ModelOptions {
  preferredProvider?: string;
  preferredModel?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface MessagingPolicy {
  enabled: boolean;
  allowedAgents: string[];
}

export interface SandboxConfig {
  enabled: boolean;
  image: string;
  memoryMb: number;
  cpuShares: number;
  networkEnabled: boolean;
  envVars: Record<string, string>;
}

export interface AgentConfig {
  agentID: string;
  name: string;
  description: string;
  promptSlug?: string;
  modelOptions?: ModelOptions;
  toolPolicy: ToolPolicy;
  messagingPolicy: MessagingPolicy;
  sandboxConfig?: SandboxConfig;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCreateInput {
  agentID: string;
  name: string;
  description?: string;
  promptSlug?: string;
  modelOptions?: ModelOptions;
  toolPolicy?: ToolPolicy;
  messagingPolicy?: MessagingPolicy;
  sandboxConfig?: SandboxConfig;
  enabled?: boolean;
}

export interface AgentUpdateInput {
  name?: string;
  description?: string;
  promptSlug?: string;
  modelOptions?: ModelOptions;
  toolPolicy?: ToolPolicy;
  messagingPolicy?: MessagingPolicy;
  sandboxConfig?: SandboxConfig;
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

export async function listAgents(): Promise<AgentConfig[]> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/agents`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.statusText}`);
  }
  return response.json();
}

export async function getAgent(agentID: string): Promise<AgentConfig> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/agents/${encodeURIComponent(agentID)}`,
    { headers: { Cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch agent: ${response.statusText}`);
  }
  return response.json();
}

export async function createAgent(
  input: AgentCreateInput,
): Promise<AgentConfig> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/agents`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to create agent: ${response.statusText}`);
  }
  return response.json();
}

export async function saveAgent(
  agentID: string,
  input: AgentUpdateInput,
): Promise<AgentConfig> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/agents/${encodeURIComponent(agentID)}`,
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
    throw new Error(`Failed to save agent: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteAgent(agentID: string): Promise<void> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/agents/${encodeURIComponent(agentID)}`,
    { method: "DELETE", headers: { Cookie: cookieHeader } },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete agent: ${response.statusText}`);
  }
}
