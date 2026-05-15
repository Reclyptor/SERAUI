"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Attachment, Message, ToolCallBlock } from "@/app/actions/chat";
import { getModelByID } from "@/app/lib/models";

const API_BASE = "/api/v1/agent";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BACKOFF_MIN_MS = 500;
const RECONNECT_BACKOFF_MAX_MS = 8000;

type StreamMode = "fresh" | "reconnect-mount" | "resume";

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
  streamID?: string;
}

interface UseAgentChatOptions {
  initialMessages?: Message[];
  chatID?: string | null;
  threadID?: string;
  initialModel?: string;
}

interface UseAgentChatReturn {
  messages: Message[];
  isLoading: boolean;
  chatID: string | null;
  threadID: string | null;
  runID: string | null;
  model: string | null;
  setModel: (model: string) => void;
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  stopGeneration: () => void;
  setMessages: (messages: Message[]) => void;
  queue: string[];
  dismissFromQueue: (index: number) => void;
  pendingConfirmations: PendingConfirmation[];
  resolveConfirmation: (
    confirmationID: string,
    approved: boolean,
    feedback?: string,
  ) => Promise<void>;
}

interface QueuedMessage {
  content: string;
  attachments?: Attachment[];
}

export function useAgentChat(
  options: UseAgentChatOptions = {},
): UseAgentChatReturn {
  const [messages, setMessages] = useState<Message[]>(
    options.initialMessages ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [chatID, setChatID] = useState<string | null>(options.chatID ?? null);
  const [threadID, setThreadID] = useState<string | null>(
    options.threadID ?? null,
  );
  const [runID, setRunID] = useState<string | null>(null);
  const [model, setModelState] = useState<string | null>(
    options.initialModel ?? null,
  );

  useEffect(() => {
    if (!options.initialModel) {
      const stored = localStorage.getItem("sera:lastModel");
      if (stored && getModelByID(stored)) {
        setModelState(stored);
      } else if (stored) {
        localStorage.removeItem("sera:lastModel");
      }
    }
  }, [options.initialModel]);

  const setModel = useCallback((value: string) => {
    setModelState(value);
    localStorage.setItem("sera:lastModel", value);
  }, []);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingConfirmation[]
  >([]);

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
  const lastEventIDRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of pendingConfirmations for stale-closure-safe reads inside the
  // long-lived stream callbacks (which can fire after retries delay them).
  const pendingConfirmationsRef = useRef<PendingConfirmation[]>([]);

  const prevChatIDRef = useRef(options.chatID);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    lastEventIDRef.current = null;
    abortRef.current = null;
  }, []);

  useEffect(() => {
    pendingConfirmationsRef.current = pendingConfirmations;
  }, [pendingConfirmations]);

  // Reset all state when switching chats
  useEffect(() => {
    if (options.chatID === prevChatIDRef.current) return;
    prevChatIDRef.current = options.chatID;

    cleanup();
    setMessages(options.initialMessages ?? []);
    setChatID(options.chatID ?? null);
    setThreadID(options.threadID ?? null);
    setRunID(null);
    setIsLoading(false);
    setQueue([]);
    setPendingConfirmations([]);
    sendingRef.current = false;
    reconnectingRef.current = false;

    if (options.initialModel) {
      setModelState(options.initialModel);
    }
  }, [
    options.chatID,
    options.initialMessages,
    options.threadID,
    options.initialModel,
    cleanup,
  ]);

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
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }, []);

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      const replaying = replayingRef.current;

      switch (event.type) {
        case "thinking.delta": {
          const { content } = event.data as { content: string };
          thinkingContentRef.current += content;
          if (!replaying) {
            if (thinkingStartTimeRef.current === null) {
              thinkingStartTimeRef.current = Date.now();
            }
            updateAssistantMessage({ thinking: thinkingContentRef.current });
          } else if (thinkingStartTimeRef.current === null) {
            thinkingStartTimeRef.current = event.timestamp;
          }
          break;
        }

        case "thinking.done": {
          const { content } = event.data as { content: string };
          if (content) thinkingContentRef.current = content;
          thinkingDoneRef.current = true;
          if (!replaying) {
            if (thinkingStartTimeRef.current !== null) {
              thinkingDurationRef.current = Math.round(
                (Date.now() - thinkingStartTimeRef.current) / 1000,
              );
            }
            updateAssistantMessage({
              thinking: thinkingContentRef.current,
              thinkingDuration: thinkingDurationRef.current,
            });
          } else if (thinkingStartTimeRef.current !== null) {
            thinkingDurationRef.current = Math.round(
              (event.timestamp - thinkingStartTimeRef.current) / 1000,
            );
          }
          break;
        }

        case "text.delta": {
          const { content } = event.data as { content: string };
          assistantContentRef.current += content;
          if (!replaying) {
            updateAssistantMessage({ content: assistantContentRef.current });
          }
          break;
        }

        case "text.done": {
          const { content } = event.data as { content: string };
          if (content) assistantContentRef.current = content;
          if (!replaying) {
            updateAssistantMessage({ content: assistantContentRef.current });
          }
          break;
        }

        case "run.completed": {
          if (replaying) {
            replayTerminalRef.current = event;
            break;
          }
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
          if (replaying) {
            replayTerminalRef.current = event;
            break;
          }
          const { error } = event.data as { error: string };
          const id = assistantIdRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? { ...m, content: m.content || `Error: ${error}` }
                : m,
            ),
          );
          sendingRef.current = false;
          reconnectingRef.current = false;
          cleanup();
          setIsLoading(false);
          break;
        }

        case "run.cancelled": {
          if (replaying) {
            replayTerminalRef.current = event;
            break;
          }
          const { reason } = event.data as { reason?: string };
          const id = assistantIdRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? { ...m, content: m.content || reason || "Run cancelled." }
                : m,
            ),
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
          if (replaying) {
            replayConfirmationsRef.current.push({
              confirmationID,
              actionName,
              args,
              message,
              threadID: event.threadID,
            });
          } else {
            setPendingConfirmations((prev) => [
              ...prev,
              {
                confirmationID,
                actionName,
                args,
                message,
                threadID: event.threadID,
              },
            ]);
          }
          break;
        }

        case "confirmation.resolved": {
          const { confirmationID } = event.data as { confirmationID: string };
          if (replaying) {
            replayConfirmationsRef.current =
              replayConfirmationsRef.current.filter(
                (c) => c.confirmationID !== confirmationID,
              );
          } else {
            setPendingConfirmations((prev) =>
              prev.filter((c) => c.confirmationID !== confirmationID),
            );
          }
          break;
        }

        case "tool_call.started": {
          const { toolCallID, toolName, args } = event.data as {
            toolCallID: string;
            toolName: string;
            args: Record<string, unknown>;
          };
          toolCallsRef.current = [
            ...toolCallsRef.current,
            { toolCallID, toolName, args, status: "started" },
          ];
          if (!replaying) {
            updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
          }
          break;
        }

        case "tool_call.executing": {
          const { toolCallID } = event.data as { toolCallID: string };
          toolCallsRef.current = toolCallsRef.current.map((tc) =>
            tc.toolCallID === toolCallID ? { ...tc, status: "executing" } : tc,
          );
          if (!replaying) {
            updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
          }
          break;
        }

        case "tool_call.result": {
          const { toolCallID, result } = event.data as {
            toolCallID: string;
            result: unknown;
          };
          toolCallsRef.current = toolCallsRef.current.map((tc) =>
            tc.toolCallID === toolCallID
              ? { ...tc, status: "completed", result }
              : tc,
          );
          if (!replaying) {
            updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
          }
          break;
        }

        case "tool_call.error": {
          const { toolCallID, error } = event.data as {
            toolCallID: string;
            error: string;
          };
          toolCallsRef.current = toolCallsRef.current.map((tc) =>
            tc.toolCallID === toolCallID
              ? { ...tc, status: "failed", error }
              : tc,
          );
          if (!replaying) {
            updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
          }
          break;
        }

        case "subagent.spawned": {
          const { toolCallID, subagentRunID, subagentThreadID, agentID, goal } =
            event.data as {
              toolCallID: string;
              subagentRunID: string;
              subagentThreadID: string;
              agentID: string;
              goal: string;
            };
          toolCallsRef.current = toolCallsRef.current.map((tc) =>
            tc.toolCallID === toolCallID
              ? {
                  ...tc,
                  isSubagent: true,
                  subagentMeta: {
                    runID: subagentRunID,
                    threadID: subagentThreadID,
                    agentID,
                    goal,
                  },
                }
              : tc,
          );
          if (!replaying) {
            updateAssistantMessage({ toolCalls: [...toolCallsRef.current] });
          }
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
    },
    [cleanup, updateAssistantMessage],
  );

  const flushReplay = useCallback(() => {
    replayingRef.current = false;

    updateAssistantMessage({
      content: assistantContentRef.current,
      thinking: thinkingContentRef.current || undefined,
      thinkingDuration: thinkingDurationRef.current,
      toolCalls:
        toolCallsRef.current.length > 0 ? [...toolCallsRef.current] : undefined,
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

  const subscribeToStream = useCallback(
    (streamRunID: string, mode: StreamMode = "fresh") => {
      const isReplay = mode !== "fresh";
      const preserveLiveState = mode === "resume";

      assistantIdRef.current = assistantIdRef.current || crypto.randomUUID();

      if (!preserveLiveState) {
        assistantContentRef.current = "";
        thinkingContentRef.current = "";
        thinkingDoneRef.current = false;
        thinkingStartTimeRef.current = null;
        thinkingDurationRef.current = undefined;
        toolCallsRef.current = [];
        lastEventIDRef.current = null;
        reconnectAttemptsRef.current = 0;
      }
      replayingRef.current = isReplay;
      // On resume, seed the replay accumulator with the live set so missed
      // adds/resolves apply on top — flushReplay replaces wholesale.
      replayConfirmationsRef.current = preserveLiveState
        ? [...pendingConfirmationsRef.current]
        : [];
      replayTerminalRef.current = null;

      setIsLoading(true);

      const cursor = preserveLiveState ? (lastEventIDRef.current ?? "0") : "0";
      const url =
        cursor === "0"
          ? `${API_BASE}/stream/${streamRunID}`
          : `${API_BASE}/stream/${streamRunID}?last-event-id=${encodeURIComponent(cursor)}`;

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const agentEvent: AgentEvent = JSON.parse(event.data);

          // Any message proves the socket is healthy — clear retry counter.
          reconnectAttemptsRef.current = 0;

          if (agentEvent.type === "replay.done") {
            flushReplay();
            return;
          }

          if (agentEvent.streamID) {
            lastEventIDRef.current = agentEvent.streamID;
          }

          handleEvent(agentEvent);
        } catch {
          // Ignore malformed events
        }
      };

      es.onerror = () => {
        // EventSource sets readyState to CONNECTING when the browser is
        // attempting its own native reconnect. Defer to it; onerror will fire
        // again with CLOSED if that gives up.
        if (es.readyState !== EventSource.CLOSED) return;

        if (eventSourceRef.current === es) {
          eventSourceRef.current = null;
        }
        es.close();

        // If the run already wrapped up via a terminal event, terminal-branch
        // cleanup has already cleared these flags. Nothing to recover.
        if (!sendingRef.current && !reconnectingRef.current) {
          replayingRef.current = false;
          setIsLoading(false);
          return;
        }

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          sendingRef.current = false;
          reconnectingRef.current = false;
          replayingRef.current = false;
          setIsLoading(false);
          return;
        }

        const attempt = reconnectAttemptsRef.current;
        const delay = Math.min(
          RECONNECT_BACKOFF_MIN_MS * 2 ** attempt,
          RECONNECT_BACKOFF_MAX_MS,
        );
        reconnectAttemptsRef.current = attempt + 1;

        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          subscribeToStream(streamRunID, "resume");
        }, delay);
      };
    },
    [handleEvent, flushReplay],
  );

  const sendMessage = useCallback(
    async (content: string, attachments: Attachment[] = []) => {
      if (!content.trim() && attachments.length === 0) return;
      if (sendingRef.current) {
        setQueue((prev) => [...prev, { content, attachments }]);
        return;
      }
      sendingRef.current = true;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        attachments,
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
            attachmentIDs: attachments.map((attachment) => attachment.id),
            chatID: chatID ?? undefined,
            threadID: threadID ?? undefined,
            model: model ?? undefined,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat request failed: ${response.statusText}`);
        }

        const {
          runID: newRunID,
          threadID: newThreadID,
          chatID: newChatID,
        } = await response.json();
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
    },
    [messages, chatID, threadID, model, cleanup, subscribeToStream],
  );

  // Check for an active run on mount (handles page refresh mid-stream)
  useEffect(() => {
    if (!options.chatID || reconnectingRef.current || sendingRef.current)
      return;

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

        subscribeToStream(data.runID, "reconnect-mount");
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [options.chatID, subscribeToStream]);

  const resolveConfirmation = useCallback(
    async (confirmationID: string, approved: boolean, feedback?: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationID === confirmationID,
      );
      if (!confirmation) return;

      try {
        const res = await fetch(
          `${API_BASE}/confirm/${confirmation.threadID}/${confirmationID}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approved, feedback }),
          },
        );
        const data = (await res.json().catch(() => null)) as {
          resolved?: boolean;
        } | null;
        if (res.ok && data?.resolved) {
          setPendingConfirmations((prev) =>
            prev.filter((c) => c.confirmationID !== confirmationID),
          );
        }
      } catch (err) {
        console.error("[useAgentChat] Failed to resolve confirmation:", err);
      }
    },
    [pendingConfirmations],
  );

  const dismissFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Dequeue next message when the current run completes
  useEffect(() => {
    if (!isLoading && queue.length > 0 && !sendingRef.current) {
      const [next, ...rest] = queue;
      setQueue(rest);
      sendMessage(next.content, next.attachments);
    }
  }, [isLoading, queue, sendMessage]);

  return {
    messages,
    isLoading,
    chatID,
    threadID,
    runID,
    model,
    setModel,
    sendMessage,
    stopGeneration,
    setMessages,
    queue: queue.map((item) => item.content),
    dismissFromQueue,
    pendingConfirmations,
    resolveConfirmation,
  };
}
