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
  chatId?: string | null;
  threadId?: string;
}

interface UseAgentChatReturn {
  messages: Message[];
  isLoading: boolean;
  chatId: string | null;
  threadId: string | null;
  runId: string | null;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  setMessages: (messages: Message[]) => void;
  queue: string[];
  dismissFromQueue: (index: number) => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}): UseAgentChatReturn {
  const [messages, setMessages] = useState<Message[]>(options.initialMessages ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(options.chatId ?? null);
  const [threadId, setThreadId] = useState<string | null>(options.threadId ?? null);
  const [runId, setRunId] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
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
    sendingRef.current = false;
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
    if (!content.trim()) return;
    if (sendingRef.current) {
      setQueue(prev => [...prev, content]);
      return;
    }
    sendingRef.current = true;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };

    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setIsLoading(true);

    try {
      const abortController = new AbortController();
      abortRef.current = abortController;

      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          chatId: chatId ?? undefined,
          threadId: threadId ?? undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.statusText}`);
      }

      const { runId: newRunId, threadId: newThreadId, chatId: newChatId } = await response.json();
      setChatId(newChatId);
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
        sendingRef.current = false;
        cleanup();
        setIsLoading(false);
      };
    } catch (error) {
      sendingRef.current = false;
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("[useAgentChat] Error:", error);
      cleanup();
      setIsLoading(false);
    }
  }, [messages, chatId, threadId, cleanup]);

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
        sendingRef.current = false;
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
        sendingRef.current = false;
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

  const dismissFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Dequeue next message when the current run completes
  useEffect(() => {
    if (!isLoading && queue.length > 0 && !sendingRef.current) {
      const [next, ...rest] = queue;
      setQueue(rest);
      sendMessage(next);
    }
  }, [isLoading, queue, sendMessage]);

  return {
    messages,
    isLoading,
    chatId,
    threadId,
    runId,
    sendMessage,
    stopGeneration,
    setMessages,
    queue,
    dismissFromQueue,
  };
}
