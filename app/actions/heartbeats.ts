"use server";

import { seraFetch } from "./_client";

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

export async function listHeartbeats(): Promise<HeartbeatConfig[]> {
  return seraFetch<HeartbeatConfig[]>("/heartbeats", {
    errorContext: "Failed to fetch heartbeats",
  });
}

export async function getHeartbeat(agentID: string): Promise<HeartbeatConfig> {
  return seraFetch<HeartbeatConfig>(
    `/heartbeats/${encodeURIComponent(agentID)}`,
    { errorContext: "Failed to fetch heartbeat" },
  );
}

export async function createHeartbeat(
  input: HeartbeatCreateInput,
): Promise<HeartbeatConfig> {
  return seraFetch<HeartbeatConfig>("/heartbeats", {
    method: "POST",
    body: input,
    errorContext: "Failed to create heartbeat",
  });
}

export async function saveHeartbeat(
  agentID: string,
  input: HeartbeatUpdateInput,
): Promise<HeartbeatConfig> {
  return seraFetch<HeartbeatConfig>(
    `/heartbeats/${encodeURIComponent(agentID)}`,
    {
      method: "PUT",
      body: input,
      errorContext: "Failed to save heartbeat",
    },
  );
}

export async function deleteHeartbeat(agentID: string): Promise<void> {
  await seraFetch<void>(`/heartbeats/${encodeURIComponent(agentID)}`, {
    method: "DELETE",
    errorContext: "Failed to delete heartbeat",
  });
}
