"use server";

import { cookies } from "next/headers";

const API_BASE_URL = process.env.SERA_API_URL ?? "http://localhost:3001";
const API_PREFIX = "/api/v1";

export interface CronJob {
  jobID: string;
  agentID: string;
  schedule: string;
  command: string;
  description: string;
  enabled: boolean;
  script: string;
  contextFromJobID: string;
  lastRunID: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CronCreateInput {
  agentID: string;
  schedule: string;
  command: string;
  description?: string;
  enabled?: boolean;
  script?: string;
  contextFromJobID?: string;
}

export interface CronUpdateInput {
  schedule?: string;
  command?: string;
  description?: string;
  enabled?: boolean;
  script?: string;
  contextFromJobID?: string;
}

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  if (allCookies.length === 0) {
    throw new Error("Not authenticated");
  }
  return allCookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export async function listCrons(agentID?: string): Promise<CronJob[]> {
  const cookieHeader = await getCookieHeader();
  const url = agentID
    ? `${API_BASE_URL}${API_PREFIX}/crons?agentID=${encodeURIComponent(agentID)}`
    : `${API_BASE_URL}${API_PREFIX}/crons`;
  const response = await fetch(url, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch cron jobs: ${response.statusText}`);
  }
  return response.json();
}

export async function getCron(jobID: string): Promise<CronJob> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/crons/${encodeURIComponent(jobID)}`,
    { headers: { Cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch cron job: ${response.statusText}`);
  }
  return response.json();
}

export async function createCron(input: CronCreateInput): Promise<CronJob> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/crons`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to create cron job: ${response.statusText}`);
  }
  return response.json();
}

export async function saveCron(
  jobID: string,
  input: CronUpdateInput,
): Promise<CronJob> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/crons/${encodeURIComponent(jobID)}`,
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
    throw new Error(`Failed to save cron job: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteCron(jobID: string): Promise<void> {
  const cookieHeader = await getCookieHeader();
  const response = await fetch(
    `${API_BASE_URL}${API_PREFIX}/crons/${encodeURIComponent(jobID)}`,
    { method: "DELETE", headers: { Cookie: cookieHeader } },
  );
  if (!response.ok) {
    throw new Error(`Failed to delete cron job: ${response.statusText}`);
  }
}
