"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Message } from "@/app/actions/chat";

const API_BASE = "/api/v1/agent";

export interface PendingConfirmation {
  confirmationID: string;
  actionName: string;
  args: Record<string, unknown>;
  message: string;
  threadID: string;
}

interface AgentEvent {
  type: string;
  runID: string;
  threadID: string;
  timestamp: number;
  data: unknown;
}

interface UseAgentChatOptions {
  initialMessages?: Message[];
  chatID?: string | null;
  threadID?: string;
}

interface UseAgentChatReturn {
  messages: Message[];
  isLoading: boolean;
  chatID: string | null;
  threadID: string | null;
  runID: string | null;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  setMessages: (messages: Message[]) => void;
  queue: string[];
  dismissFromQueue: (index: number) => void;
  pendingConfirmations: PendingConfirmation[];
  resolveConfirmation: (confirmationID: string, approved: boolean, feedback?: string) => Promise<void>;
}

export function useAgentChat(options: UseAgentChatOptions = {}): UseAgentChatReturn {
  const [messages, setMessages] = useState<Message[]>(options.initialMessages ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [chatID, setChatID] = useState<string | null>(options.chatID ?? null);
  const [threadID, setThreadID] = useState<string | null>(options.threadID ?? null);
  const [runID, setRunID] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);

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
    if (runID) {
      fetch(`${API_BASE}/cancel/${runID}`, { method: "POST" }).catch(() => {});
    }
    sendingRef.current = false;
    cleanup();
    setIsLoading(false);
  }, [runID, cleanup]);

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
          chatID: chatID ?? undefined,
          threadID: threadID ?? undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.statusText}`);
      }

      const { runID: newRunID, threadID: newThreadID, chatID: newChatID } = await response.json();
      setChatID(newChatID);
      setRunID(newRunID);
      setThreadID(newThreadID);

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

      const es = new EventSource(`${API_BASE}/stream/${newRunID}`);
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
  }, [messages, chatID, threadID, cleanup]);

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

      case "confirmation.required": {
        const { confirmationID, actionName, args, message } = event.data as {
          confirmationID: string;
          actionName: string;
          args: Record<string, unknown>;
          message: string;
        };
        setPendingConfirmations((prev) => [
          ...prev,
          { confirmationID, actionName, args, message, threadID: event.threadID },
        ]);
        break;
      }

      case "confirmation.resolved": {
        const { confirmationID } = event.data as { confirmationID: string };
        setPendingConfirmations((prev) =>
          prev.filter((c) => c.confirmationID !== confirmationID)
        );
        break;
      }

      case "tool_call.started":
      case "tool_call.executing":
      case "tool_call.result":
      case "tool_call.error":
      case "plan.created":
      case "plan.step_updated":
      case "evaluation.done":
      case "error":
        break;
    }
  }, [cleanup, updateAssistantMessage]);

  const resolveConfirmation = useCallback(
    async (confirmationID: string, approved: boolean, feedback?: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationID === confirmationID
      );
      if (!confirmation) return;

      try {
        const res = await fetch(
          `${API_BASE}/confirm/${confirmation.threadID}/${confirmationID}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approved, feedback }),
          }
        );
        if (res.ok) {
          setPendingConfirmations((prev) =>
            prev.filter((c) => c.confirmationID !== confirmationID)
          );
        }
      } catch (err) {
        console.error("[useAgentChat] Failed to resolve confirmation:", err);
      }
    },
    [pendingConfirmations]
  );

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
    chatID,
    threadID,
    runID,
    sendMessage,
    stopGeneration,
    setMessages,
    queue,
    dismissFromQueue,
    pendingConfirmations,
    resolveConfirmation,
  };
}
