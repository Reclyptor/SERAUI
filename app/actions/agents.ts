"use server";

import { seraFetch } from "./_client";

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

export async function listAgents(): Promise<AgentConfig[]> {
  return seraFetch<AgentConfig[]>("/agents", {
    errorContext: "Failed to fetch agents",
  });
}

export async function getAgent(agentID: string): Promise<AgentConfig> {
  return seraFetch<AgentConfig>(`/agents/${encodeURIComponent(agentID)}`, {
    errorContext: "Failed to fetch agent",
  });
}

export async function createAgent(
  input: AgentCreateInput,
): Promise<AgentConfig> {
  return seraFetch<AgentConfig>("/agents", {
    method: "POST",
    body: input,
    errorContext: "Failed to create agent",
  });
}

export async function saveAgent(
  agentID: string,
  input: AgentUpdateInput,
): Promise<AgentConfig> {
  return seraFetch<AgentConfig>(`/agents/${encodeURIComponent(agentID)}`, {
    method: "PUT",
    body: input,
    errorContext: "Failed to save agent",
  });
}

export async function deleteAgent(agentID: string): Promise<void> {
  await seraFetch<void>(`/agents/${encodeURIComponent(agentID)}`, {
    method: "DELETE",
    errorContext: "Failed to delete agent",
  });
}
