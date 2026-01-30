"use server";

import { auth } from "@/lib/auth";

// Derive base URL from the CopilotKit runtime URL (strip /copilotkit suffix)
const COPILOTKIT_URL = process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL ?? "http://localhost:3001/copilotkit";
const API_BASE_URL = COPILOTKIT_URL.replace(/\/copilotkit\/?$/, "");

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date;
}

export interface Chat {
  _id: string;
  userID: string;
  title: string;
  messages: Message[];
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

async function getAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }
  return session.accessToken;
}

export async function getChats(): Promise<ChatListItem[]> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_BASE_URL}/chats`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chats: ${response.statusText}`);
  }

  return response.json();
}

export async function getChat(chatID: string): Promise<Chat> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_BASE_URL}/chats/${chatID}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chat: ${response.statusText}`);
  }

  return response.json();
}

export async function createChat(messages: Message[]): Promise<Chat> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_BASE_URL}/chats`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create chat: ${response.statusText}`);
  }

  return response.json();
}

export async function updateChat(chatID: string, messages: Message[]): Promise<Chat> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_BASE_URL}/chats/${chatID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update chat: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteChat(chatID: string): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_BASE_URL}/chats/${chatID}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete chat: ${response.statusText}`);
  }
}
