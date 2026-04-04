"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Message } from "@/app/actions/chat";

const API_BASE = "/api/v1/agent";

function buildMessageContent(thinking: string, thinkingDone: boolean, text: string, durationSec?: number): string {
  if (!thinking) return text;
  const tag = durationSec != null ? `[THINKING:${durationSec}]` : "[THINKING]";
  if (thinkingDone) return `${tag}\n${thinking}\n[/THINKING]\n${text}`;
  return `${tag}\n${thinking}`;
}

interface AgentEvent {
  type: string;
  runId: string;
  threadId: string;
  timestamp: number;
  data: any;
}

interface UseAgentChatOptions {
  initialMessages?: Message[];
  threadId?: string;
}

interface UseAgentChatReturn {
  messages: Message[];
  isLoading: boolean;
  threadId: string | null;
  runId: string | null;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  setMessages: (messages: Message[]) => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}): UseAgentChatReturn {
  const [messages, setMessages] = useState<Message[]>(options.initialMessages ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(options.threadId ?? null);
  const [runId, setRunId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const assistantContentRef = useRef("");
  const assistantIdRef = useRef("");
  const thinkingContentRef = useRef("");
  const thinkingDoneRef = useRef(false);
  const thinkingStartTimeRef = useRef<number | null>(null);
  const thinkingDurationRef = useRef<number | undefined>(undefined);

  // Sync initial messages when they change (e.g., hydration from server)
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current && options.initialMessages && options.initialMessages.length > 0) {
      setMessages(options.initialMessages);
      hydratedRef.current = true;
    }
  }, [options.initialMessages]);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    abortRef.current = null;
  }, []);

  const stopGeneration = useCallback(() => {
    if (runId) {
      fetch(`${API_BASE}/cancel/${runId}`, { method: "POST" }).catch(() => {});
    }
    cleanup();
    setIsLoading(false);
  }, [runId, cleanup]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message immediately
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };

    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setIsLoading(true);

    // Build conversation history for the backend
    const conversationHistory = currentMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      // 1. Start the run
      const abortController = new AbortController();
      abortRef.current = abortController;

      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          threadId: threadId ?? undefined,
          conversationHistory,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.statusText}`);
      }

      const { runId: newRunId, threadId: newThreadId } = await response.json();
      setRunId(newRunId);
      setThreadId(newThreadId);

      // 2. Prepare assistant message
      assistantIdRef.current = crypto.randomUUID();
      assistantContentRef.current = "";
      thinkingContentRef.current = "";
      thinkingDoneRef.current = false;
      thinkingStartTimeRef.current = null;
      thinkingDurationRef.current = undefined;

      const assistantMessage: Message = {
        id: assistantIdRef.current,
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 3. Subscribe to SSE stream
      const es = new EventSource(`${API_BASE}/stream/${newRunId}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const agentEvent: AgentEvent = JSON.parse(event.data);
          handleEvent(agentEvent);
        } catch {
          // Ignore malformed events
        }
      };

      es.onerror = () => {
        cleanup();
        setIsLoading(false);
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // User cancelled — already handled
        return;
      }
      console.error("[useAgentChat] Error:", error);
      cleanup();
      setIsLoading(false);
    }
  }, [messages, isLoading, threadId, cleanup]);

  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case "thinking.delta": {
        if (thinkingStartTimeRef.current === null) {
          thinkingStartTimeRef.current = Date.now();
        }
        const { content } = event.data as { content: string };
        thinkingContentRef.current += content;
        const id = assistantIdRef.current;
        const fullContent = buildMessageContent(thinkingContentRef.current, false, assistantContentRef.current);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: fullContent } : m))
        );
        break;
      }

      case "thinking.done": {
        const { content } = event.data as { content: string };
        if (content) {
          thinkingContentRef.current = content;
        }
        thinkingDoneRef.current = true;
        if (thinkingStartTimeRef.current !== null) {
          thinkingDurationRef.current = Math.round((Date.now() - thinkingStartTimeRef.current) / 1000);
        }
        const id = assistantIdRef.current;
        const fullContent = buildMessageContent(thinkingContentRef.current, true, assistantContentRef.current, thinkingDurationRef.current);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: fullContent } : m))
        );
        break;
      }

      case "text.delta": {
        const { content } = event.data as { content: string };
        assistantContentRef.current += content;
        const id = assistantIdRef.current;
        const fullContent = buildMessageContent(thinkingContentRef.current, thinkingDoneRef.current, assistantContentRef.current, thinkingDurationRef.current);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: fullContent } : m))
        );
        break;
      }

      case "text.done": {
        const { content } = event.data as { content: string };
        if (content) {
          assistantContentRef.current = content;
        }
        const id = assistantIdRef.current;
        const fullContent = buildMessageContent(thinkingContentRef.current, thinkingDoneRef.current, assistantContentRef.current, thinkingDurationRef.current);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: fullContent } : m))
        );
        break;
      }

      case "run.completed": {
        const { response } = event.data as { response: string };
        if (response && !assistantContentRef.current) {
          const id = assistantIdRef.current;
          const fullContent = buildMessageContent(thinkingContentRef.current, thinkingDoneRef.current, response, thinkingDurationRef.current);
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content: fullContent } : m))
          );
        }
        cleanup();
        setIsLoading(false);
        break;
      }

      case "run.failed": {
        const { error } = event.data as { error: string };
        const id = assistantIdRef.current;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, content: m.content || `Error: ${error}` }
              : m
          )
        );
        cleanup();
        setIsLoading(false);
        break;
      }

      // Tool events — could be surfaced in UI later
      case "tool_call.started":
      case "tool_call.executing":
      case "tool_call.result":
      case "tool_call.error":
      case "plan.created":
      case "plan.step_updated":
      case "evaluation.done":
      case "confirmation.required":
      case "confirmation.resolved":
      case "error":
        // For now, these are no-ops on the frontend
        break;
    }
  }, [cleanup]);

  return {
    messages,
    isLoading,
    threadId,
    runId,
    sendMessage,
    stopGeneration,
    setMessages,
  };
}
