"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Attachment, Message } from "@/app/actions/chat";
import { getModelBySpec } from "@/app/lib/models";
import { useModelCatalog } from "@/app/contexts/ModelCatalogContext";
import {
  buildStreamURL,
  emptyStreamState,
  reduceAgentEvent,
  streamStateToMessagePatch,
  type AgentEvent,
  type AgentStreamState,
  type PendingConfirmation,
} from "@/app/lib/agentEvents";

export type { PendingConfirmation } from "@/app/lib/agentEvents";

const API_BASE = "/api/v1/agent";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BACKOFF_MIN_MS = 500;
const RECONNECT_BACKOFF_MAX_MS = 8000;

type StreamMode = "fresh" | "reconnect-mount" | "resume";

interface UseAgentChatOptions {
  initialMessages?: Message[];
  chatID?: string | null;
  threadID?: string;
  initialModel?: string;
  initialAgentID?: string;
}

interface UseAgentChatReturn {
  messages: Message[];
  isLoading: boolean;
  chatID: string | null;
  threadID: string | null;
  runID: string | null;
  model: string | null;
  setModel: (model: string) => void;
  agentID: string | null;
  setAgentID: (agentID: string | null) => void;
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  stopGeneration: () => void;
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
  const [agentID, setAgentIDState] = useState<string | null>(
    options.initialAgentID ?? null,
  );
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingConfirmation[]
  >([]);

  // Latest options snapshot — read by the chat-switch reset effect so that
  // re-renders with a fresh initialMessages array reference don't re-trigger
  // the reset (it's only meaningful when chatID actually changes).
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Single stream state — replaces 8 separate refs from the previous design.
  // The pure reducer in `agentEvents.ts` owns the transition; the hook only
  // dispatches events into it and projects the result into React state.
  const streamStateRef = useRef<AgentStreamState>(emptyStreamState());

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const assistantIdRef = useRef("");
  const reconnectingRef = useRef(false);
  const replayingRef = useRef(false);
  const lastEventIDRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of pendingConfirmations for stale-closure-safe reads inside the
  // long-lived stream callbacks (which can fire after retries delay them).
  const pendingConfirmationsRef = useRef<PendingConfirmation[]>([]);
  useEffect(() => {
    pendingConfirmationsRef.current = pendingConfirmations;
  }, [pendingConfirmations]);

  const prevChatIDRef = useRef(options.chatID);

  const catalog = useModelCatalog();
  // Read the catalog through a ref inside the localStorage-restore effect so
  // the effect's identity tracks only `options.initialModel`. Otherwise
  // catalog-identity churn (e.g. layout re-render after navigation) would
  // re-fire the restore and clobber whatever the user picked since mount.
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  useEffect(() => {
    if (!options.initialModel) {
      const stored = localStorage.getItem("sera:lastModel");
      if (stored && getModelBySpec(catalogRef.current, stored)) {
        setModelState(stored);
      } else if (stored) {
        localStorage.removeItem("sera:lastModel");
      }
    }
  }, [options.initialModel]);

  useEffect(() => {
    if (!options.initialAgentID) {
      const stored = localStorage.getItem("sera:lastAgentID");
      if (stored) setAgentIDState(stored);
    }
  }, [options.initialAgentID]);

  const setModel = useCallback((value: string) => {
    setModelState(value);
    localStorage.setItem("sera:lastModel", value);
  }, []);

  const setAgentID = useCallback((value: string | null) => {
    setAgentIDState(value);
    if (value) {
      localStorage.setItem("sera:lastAgentID", value);
    } else {
      localStorage.removeItem("sera:lastAgentID");
    }
  }, []);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // Non-terminal teardown: chat switch, stop generation, send-failure.
  // Aborts the in-flight POST and zeroes the resume cursor — the next stream
  // subscription starts fresh.
  const cleanup = useCallback(() => {
    closeStream();
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    lastEventIDRef.current = null;
  }, [closeStream]);

  // Terminal teardown: the run finished cleanly via run.completed / failed /
  // cancelled. Closes the socket and clears loading, but leaves the resume
  // cursor untouched (it's irrelevant — the run is over).
  const finishRun = useCallback(() => {
    closeStream();
    sendingRef.current = false;
    reconnectingRef.current = false;
    replayingRef.current = false;
    setIsLoading(false);
  }, [closeStream]);

  const updateAssistantMessage = useCallback((patch: Partial<Message>) => {
    const id = assistantIdRef.current;
    if (!id) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }, []);

  // Reset all state when switching chats. Keyed solely on chatID — other
  // options are read via optionsRef so a fresh initialMessages array
  // reference doesn't re-trigger the reset on unrelated parent renders.
  useEffect(() => {
    if (options.chatID === prevChatIDRef.current) return;
    prevChatIDRef.current = options.chatID;

    const o = optionsRef.current;
    cleanup();
    streamStateRef.current = emptyStreamState();
    setMessages(o.initialMessages ?? []);
    setChatID(o.chatID ?? null);
    setThreadID(o.threadID ?? null);
    setRunID(null);
    setIsLoading(false);
    setQueue([]);
    setPendingConfirmations([]);
    sendingRef.current = false;
    reconnectingRef.current = false;
    assistantIdRef.current = "";

    if (o.initialModel) {
      setModelState(o.initialModel);
    }
    if (o.initialAgentID !== undefined) {
      setAgentIDState(o.initialAgentID ?? null);
    }
  }, [options.chatID, cleanup]);

  const stopGeneration = useCallback(() => {
    if (runID) {
      fetch(`${API_BASE}/cancel/${runID}`, { method: "POST" }).catch(() => {});
    }
    sendingRef.current = false;
    cleanup();
    setIsLoading(false);
  }, [runID, cleanup]);

  const flushReplay = useCallback(() => {
    replayingRef.current = false;
    const state = streamStateRef.current;

    updateAssistantMessage(streamStateToMessagePatch(state));
    setPendingConfirmations(state.confirmations);

    if (state.terminal) {
      finishRun();
    }
  }, [updateAssistantMessage, finishRun]);

  const subscribeToStream = useCallback(
    (streamRunID: string, mode: StreamMode = "fresh") => {
      const isReplay = mode !== "fresh";
      const preserveLiveState = mode === "resume";

      assistantIdRef.current = assistantIdRef.current || crypto.randomUUID();

      if (!preserveLiveState) {
        streamStateRef.current = emptyStreamState();
        lastEventIDRef.current = null;
        reconnectAttemptsRef.current = 0;
      } else if (isReplay) {
        // Seed the replay accumulator's confirmations with the current live
        // set so any confirmation.resolved events arriving in the replay
        // apply against the right baseline.
        streamStateRef.current = {
          ...streamStateRef.current,
          confirmations: [...pendingConfirmationsRef.current],
          terminal: null,
        };
      }
      replayingRef.current = isReplay;

      setIsLoading(true);

      const cursor = preserveLiveState ? lastEventIDRef.current : null;
      const es = new EventSource(buildStreamURL(streamRunID, cursor));
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        let agentEvent: AgentEvent;
        try {
          agentEvent = JSON.parse(e.data);
        } catch {
          console.warn("[useAgentChat] Ignoring malformed event:", e.data);
          return;
        }

        // Any message proves the socket is healthy — clear retry counter.
        reconnectAttemptsRef.current = 0;

        if (agentEvent.type === "replay.done") {
          flushReplay();
          return;
        }

        if (agentEvent.type === "error") {
          console.warn("[useAgentChat] Server error event:", agentEvent.data);
        }

        if (agentEvent.streamID) {
          lastEventIDRef.current = agentEvent.streamID;
        }

        const prev = streamStateRef.current;
        const next = reduceAgentEvent(prev, agentEvent, {
          mode: replayingRef.current ? "replay" : "live",
          nowMs: Date.now(),
        });
        streamStateRef.current = next;

        if (replayingRef.current) return;

        if (prev.confirmations !== next.confirmations) {
          setPendingConfirmations(next.confirmations);
        }
        updateAssistantMessage(streamStateToMessagePatch(next));

        if (!prev.terminal && next.terminal) {
          finishRun();
        }
      };

      es.onerror = () => {
        if (es.readyState !== EventSource.CLOSED) return;

        if (eventSourceRef.current === es) {
          eventSourceRef.current = null;
        }
        es.close();

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
    [updateAssistantMessage, flushReplay, finishRun],
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

      // Functional update — no closure dependency on `messages`, so this
      // callback's identity is stable across renders.
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const abortController = new AbortController();
        abortRef.current = abortController;

        const response = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            attachmentIDs: attachments.map((a) => a.id),
            chatID: chatID ?? undefined,
            threadID: threadID ?? undefined,
            model: model ?? undefined,
            agentID: agentID ?? undefined,
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
    [chatID, threadID, model, agentID, cleanup, subscribeToStream],
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
      const confirmation = pendingConfirmationsRef.current.find(
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
    [],
  );

  const dismissFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Dequeue next message when the current run completes.
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
    agentID,
    setAgentID,
    sendMessage,
    stopGeneration,
    queue: queue.map((item) => item.content),
    dismissFromQueue,
    pendingConfirmations,
    resolveConfirmation,
  };
}
