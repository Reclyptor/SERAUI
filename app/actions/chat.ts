"use server";

import { cookies } from "next/headers";

// Derive base URL from the CopilotKit runtime URL (strip /copilotkit suffix)
const API_BASE_URL = process.env.SERA_API_URL ?? "http://localhost:3001";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date;
}

export interface WorkflowStateEntry {
  workflowId: string;
  status: "running" | "completed" | "failed" | "unknown";
  progress: Record<string, unknown> | null;
  pendingReviewWorkflows: string[];
  startedAt: string;
  lastSyncedAt: string;
}

export interface Chat {
  _id: string;
  userID: string;
  title: string;
  messages: Message[];
  workflowState?: WorkflowStateEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatListItem {
  _id: string;
  userID: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  if (allCookies.length === 0) {
    throw new Error("Not authenticated");
  }
  return allCookies.map(c => `${c.name}=${c.value}`).join("; ");
}

export async function getChats(): Promise<ChatListItem[]> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}/chats`, {
    headers: {
      Cookie: cookieHeader,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chats: ${response.statusText}`);
  }

  return response.json();
}

export async function getChat(chatID: string): Promise<Chat> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}/chats/${chatID}`, {
    headers: {
      Cookie: cookieHeader,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chat: ${response.statusText}`);
  }

  return response.json();
}

export async function createChat(
  messages: Message[],
  workflowState?: WorkflowStateEntry[],
): Promise<Chat> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}/chats`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, workflowState }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create chat: ${response.statusText}`);
  }

  return response.json();
}

export async function updateChat(
  chatID: string,
  messages: Message[],
  workflowState?: WorkflowStateEntry[],
): Promise<Chat> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}/chats/${chatID}`, {
    method: "PATCH",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, workflowState }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update chat: ${response.statusText}`);
  }

  return response.json();
}

export async function updateChatWorkflowState(
  chatID: string,
  workflowState: WorkflowStateEntry[],
): Promise<Chat> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}/chats/${chatID}/workflow-state`, {
    method: "PATCH",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workflowState }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update workflow state: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteChat(chatID: string): Promise<void> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}/chats/${chatID}`, {
    method: "DELETE",
    headers: {
      Cookie: cookieHeader,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete chat: ${response.statusText}`);
  }
}

export async function uploadImage(formData: FormData): Promise<{ imageID: string }> {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${API_BASE_URL}/copilotkit/upload-image`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to upload image");
  }

  return response.json();
}
