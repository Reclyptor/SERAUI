"use server";

import { seraFetch } from "./_client";

export interface SubagentMeta {
  runID: string;
  threadID: string;
  agentID: string;
  goal: string;
}

export interface ToolCallBlock {
  toolCallID: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: "started" | "executing" | "completed" | "failed";
  isSubagent?: boolean;
  subagentMeta?: SubagentMeta;
}

export interface Attachment {
  id: string;
  kind: "image" | "file";
  mimeType: string;
  size: number;
  filename?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  thinkingDuration?: number;
  toolCalls?: ToolCallBlock[];
  attachments?: Attachment[];
  createdAt?: string | Date;
}

export interface Chat {
  _id: string;
  userID: string;
  title: string;
  model?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatListItem {
  _id: string;
  userID: string;
  title: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getChats(): Promise<ChatListItem[]> {
  return seraFetch<ChatListItem[]>("/chats", {
    errorContext: "Failed to fetch chats",
  });
}

export async function getChat(chatID: string): Promise<Chat> {
  return seraFetch<Chat>(`/chats/${encodeURIComponent(chatID)}`, {
    errorContext: "Failed to fetch chat",
  });
}

export async function uploadAttachment(
  formData: FormData,
): Promise<Attachment> {
  return seraFetch<Attachment>("/agent/attachments", {
    method: "POST",
    body: formData,
    errorContext: "Failed to upload attachment",
  });
}
