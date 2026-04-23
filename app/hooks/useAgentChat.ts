"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Message, ToolCallBlock } from "@/app/actions/chat";

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
  const toolCallsRef = useRef<ToolCallBlock[]>([]);
  const reconnectingRef = useRef(false);
  const replayingRef = useRef(false);
  const replayConfirmationsRef = useRef<PendingConfirmation[]>([]);
  const replayTerminalRef = useRef<AgentEvent | null>(null);

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
        reconnectingRef.current = false;
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
        reconnectingRef.current = false;
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

      case "tool_call.started": {
        const { toolCallID, toolName, args } = event.data as {
          toolCallID: string; toolName: string; args: Record<string, unknown>;
        };
        toolCallsRef.current = [
          ...toolCallsRef.current,
          { toolCallID, toolName, args, status: "started" },
        ];
        updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
        break;
      }

      case "tool_call.executing": {
        const { toolCallID } = event.data as { toolCallID: string };
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.toolCallID === toolCallID ? { ...tc, status: "executing" } : tc
        );
        updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
        break;
      }

      case "tool_call.result": {
        const { toolCallID, result } = event.data as {
          toolCallID: string; result: unknown;
        };
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.toolCallID === toolCallID ? { ...tc, status: "completed", result } : tc
        );
        updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
        break;
      }

      case "tool_call.error": {
        const { toolCallID, error } = event.data as {
          toolCallID: string; error: string;
        };
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.toolCallID === toolCallID ? { ...tc, status: "failed", error } : tc
        );
        updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
        break;
      }

      case "subagent.spawned": {
        const { toolCallID, subagentRunID, subagentThreadID, agentID, goal } =
          event.data as {
            toolCallID: string; subagentRunID: string;
            subagentThreadID: string; agentID: string; goal: string;
          };
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.toolCallID === toolCallID
            ? {
                ...tc,
                isSubagent: true,
                subagentMeta: { runID: subagentRunID, threadID: subagentThreadID, agentID, goal },
              }
            : tc
        );
        updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
        break;
      }

      case "subagent.completed":
      case "subagent.failed":
        break;

      case "plan.created":
      case "plan.step_updated":
      case "evaluation.done":
      case "error":
        break;
    }
  }, [cleanup, updateAssistantMessage]);

  const processReplayEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case "thinking.delta": {
        const { content } = event.data as { content: string };
        thinkingContentRef.current += content;
        break;
      }
      case "thinking.done": {
        const { content } = event.data as { content: string };
        if (content) thinkingContentRef.current = content;
        thinkingDoneRef.current = true;
        break;
      }
      case "text.delta": {
        const { content } = event.data as { content: string };
        assistantContentRef.current += content;
        break;
      }
      case "text.done": {
        const { content } = event.data as { content: string };
        if (content) assistantContentRef.current = content;
        break;
      }
      case "confirmation.required": {
        const { confirmationID, actionName, args, message } = event.data as {
          confirmationID: string;
          actionName: string;
          args: Record<string, unknown>;
          message: string;
        };
        replayConfirmationsRef.current.push({
          confirmationID, actionName, args, message, threadID: event.threadID,
        });
        break;
      }
      case "confirmation.resolved": {
        const { confirmationID } = event.data as { confirmationID: string };
        replayConfirmationsRef.current = replayConfirmationsRef.current.filter(
          (c) => c.confirmationID !== confirmationID,
        );
        break;
      }
      case "tool_call.started": {
        const { toolCallID, toolName, args } = event.data as {
          toolCallID: string; toolName: string; args: Record<string, unknown>;
        };
        toolCallsRef.current = [
          ...toolCallsRef.current,
          { toolCallID, toolName, args, status: "started" },
        ];
        break;
      }
      case "tool_call.executing": {
        const { toolCallID } = event.data as { toolCallID: string };
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.toolCallID === toolCallID ? { ...tc, status: "executing" } : tc
        );
        break;
      }
      case "tool_call.result": {
        const { toolCallID, result } = event.data as { toolCallID: string; result: unknown };
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.toolCallID === toolCallID ? { ...tc, status: "completed", result } : tc
        );
        break;
      }
      case "tool_call.error": {
        const { toolCallID, error } = event.data as { toolCallID: string; error: string };
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.toolCallID === toolCallID ? { ...tc, status: "failed", error } : tc
        );
        break;
      }
      case "subagent.spawned": {
        const { toolCallID, subagentRunID, subagentThreadID, agentID, goal } =
          event.data as {
            toolCallID: string; subagentRunID: string;
            subagentThreadID: string; agentID: string; goal: string;
          };
        toolCallsRef.current = toolCallsRef.current.map((tc) =>
          tc.toolCallID === toolCallID
            ? {
                ...tc,
                isSubagent: true,
                subagentMeta: { runID: subagentRunID, threadID: subagentThreadID, agentID, goal },
              }
            : tc
        );
        break;
      }
      case "run.completed":
      case "run.failed":
        replayTerminalRef.current = event;
        break;
    }
  }, []);

  const flushReplay = useCallback(() => {
    replayingRef.current = false;

    updateAssistantMessage({
      content: assistantContentRef.current,
      thinking: thinkingContentRef.current || undefined,
      toolCalls: toolCallsRef.current.length > 0 ? [...toolCallsRef.current] : undefined,
    });

    if (replayConfirmationsRef.current.length > 0) {
      setPendingConfirmations(replayConfirmationsRef.current);
      replayConfirmationsRef.current = [];
    }

    const terminal = replayTerminalRef.current;
    replayTerminalRef.current = null;
    if (terminal) {
      handleEvent(terminal);
    }
  }, [updateAssistantMessage, handleEvent]);

  const subscribeToStream = useCallback((streamRunID: string, replay = false) => {
    assistantIdRef.current = assistantIdRef.current || crypto.randomUUID();
    assistantContentRef.current = "";
    thinkingContentRef.current = "";
    thinkingDoneRef.current = false;
    thinkingStartTimeRef.current = null;
    thinkingDurationRef.current = undefined;
    toolCallsRef.current = [];
    replayingRef.current = replay;
    replayConfirmationsRef.current = [];
    replayTerminalRef.current = null;

    setIsLoading(true);

    const url = replay
      ? `${API_BASE}/stream/${streamRunID}?replay=true`
      : `${API_BASE}/stream/${streamRunID}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const agentEvent: AgentEvent = JSON.parse(event.data);

        if (agentEvent.type === "replay.done") {
          flushReplay();
          return;
        }

        if (replayingRef.current) {
          processReplayEvent(agentEvent);
        } else {
          handleEvent(agentEvent);
        }
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      sendingRef.current = false;
      reconnectingRef.current = false;
      replayingRef.current = false;
      cleanup();
      setIsLoading(false);
    };
  }, [handleEvent, processReplayEvent, flushReplay, cleanup]);

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

      const assistantMessage: Message = {
        id: assistantIdRef.current,
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      subscribeToStream(newRunID);
    } catch (error) {
      sendingRef.current = false;
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("[useAgentChat] Error:", error);
      cleanup();
      setIsLoading(false);
    }
  }, [messages, chatID, threadID, cleanup, subscribeToStream]);

  // Check for an active run on mount (handles page refresh mid-stream)
  useEffect(() => {
    if (!options.chatID || reconnectingRef.current || sendingRef.current) return;

    let cancelled = false;

    fetch(`${API_BASE}/active-run/${options.chatID}`)
      .then((res) => {
        if (!res.ok || cancelled) return null;
        return res.json();
      })
      .then((data: { runID: string; threadID: string } | null) => {
        if (!data || cancelled) return;

        reconnectingRef.current = true;
        setRunID(data.runID);
        setThreadID(data.threadID);

        // Create a placeholder assistant message for the reconnected stream
        assistantIdRef.current = crypto.randomUUID();
        const placeholder: Message = {
          id: assistantIdRef.current,
          role: "assistant",
          content: "",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, placeholder]);

        subscribeToStream(data.runID, true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [options.chatID, subscribeToStream]);

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
