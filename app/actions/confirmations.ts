"use server";

import { seraFetch } from "./_client";

export interface ResolveConfirmationResult {
  resolved: boolean;
}

export async function resolveConfirmation(
  threadID: string,
  confirmationID: string,
  approved: boolean,
  feedback?: string,
): Promise<ResolveConfirmationResult> {
  return seraFetch<ResolveConfirmationResult>(
    `/agent/confirm/${encodeURIComponent(threadID)}/${encodeURIComponent(
      confirmationID,
    )}`,
    {
      method: "POST",
      body: { approved, feedback },
      errorContext: "Failed to resolve confirmation",
    },
  );
}
