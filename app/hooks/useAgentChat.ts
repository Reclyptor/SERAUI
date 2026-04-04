"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Message } from "@/app/actions/chat";

const API_BASE = "/api/v1/agent";

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

  const updateAssistantMessage = useCallback((patch: Partial<Message>) => {
    const id = assistantIdRef.current;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };

    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setIsLoading(true);

    // Send only content (not thinking) as conversation history
    const conversationHistory = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
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
        updateAssistantMessage({ thinking: thinkingContentRef.current });
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
        updateAssistantMessage({
          thinking: thinkingContentRef.current,
          thinkingDuration: thinkingDurationRef.current,
        });
        break;
      }

      case "text.delta": {
        const { content } = event.data as { content: string };
        assistantContentRef.current += content;
        updateAssistantMessage({ content: assistantContentRef.current });
        break;
      }

      case "text.done": {
        const { content } = event.data as { content: string };
        if (content) {
          assistantContentRef.current = content;
        }
        updateAssistantMessage({ content: assistantContentRef.current });
        break;
      }

      case "run.completed": {
        const { response } = event.data as { response: string };
        if (response && !assistantContentRef.current) {
          updateAssistantMessage({ content: response });
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
        break;
    }
  }, [cleanup, updateAssistantMessage]);

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
