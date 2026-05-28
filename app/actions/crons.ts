"use server";

import { seraFetch } from "./_client";

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

export async function listCrons(agentID?: string): Promise<CronJob[]> {
  return seraFetch<CronJob[]>("/crons", {
    query: { agentID },
    errorContext: "Failed to fetch cron jobs",
  });
}

export async function getCron(jobID: string): Promise<CronJob> {
  return seraFetch<CronJob>(`/crons/${encodeURIComponent(jobID)}`, {
    errorContext: "Failed to fetch cron job",
  });
}

export async function createCron(input: CronCreateInput): Promise<CronJob> {
  return seraFetch<CronJob>("/crons", {
    method: "POST",
    body: input,
    errorContext: "Failed to create cron job",
  });
}

export async function saveCron(
  jobID: string,
  input: CronUpdateInput,
): Promise<CronJob> {
  return seraFetch<CronJob>(`/crons/${encodeURIComponent(jobID)}`, {
    method: "PUT",
    body: input,
    errorContext: "Failed to save cron job",
  });
}

export async function deleteCron(jobID: string): Promise<void> {
  await seraFetch<void>(`/crons/${encodeURIComponent(jobID)}`, {
    method: "DELETE",
    errorContext: "Failed to delete cron job",
  });
}
