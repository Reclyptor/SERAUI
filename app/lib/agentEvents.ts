import type { Message, ToolCallBlock } from "@/app/actions/chat";

export interface PendingConfirmation {
  confirmationID: string;
  actionName: string;
  args: Record<string, unknown>;
  message: string;
  threadID: string;
}

export interface AgentEvent {
  type: string;
  runID: string;
  threadID: string;
  timestamp: number;
  data: unknown;
  streamID?: string;
}

export type TerminalReason = "completed" | "failed" | "cancelled";

export interface AgentStreamState {
  assistantContent: string;
  thinking: string;
  thinkingStartMs: number | null;
  thinkingDuration: number | undefined;
  toolCalls: ToolCallBlock[];
  confirmations: PendingConfirmation[];
  terminal: TerminalReason | null;
}

export function emptyStreamState(): AgentStreamState {
  return {
    assistantContent: "",
    thinking: "",
    thinkingStartMs: null,
    thinkingDuration: undefined,
    toolCalls: [],
    confirmations: [],
    terminal: null,
  };
}

// At least 1 second so a sub-second thinking block doesn't render as
// "Thought for 0s" (the previous implementation rounded straight down).
export function computeThinkingDuration(
  startMs: number,
  endMs: number,
): number {
  return Math.max(1, Math.round((endMs - startMs) / 1000));
}

const STREAM_BASE = "/api/v1/agent/stream";

export function buildStreamURL(runID: string, cursor: string | null): string {
  const base = `${STREAM_BASE}/${encodeURIComponent(runID)}`;
  if (!cursor || cursor === "0") return base;
  return `${base}?last-event-id=${encodeURIComponent(cursor)}`;
}

interface ReduceOptions {
  mode: "live" | "replay";
  // Wall clock used in live mode. In replay mode the reducer uses
  // event.timestamp instead so replayed durations match the originals.
  nowMs: number;
}

export function reduceAgentEvent(
  state: AgentStreamState,
  event: AgentEvent,
  options: ReduceOptions,
): AgentStreamState {
  const { mode, nowMs } = options;
  const data = (event.data ?? {}) as Record<string, unknown>;

  switch (event.type) {
    case "thinking.delta": {
      const content = typeof data.content === "string" ? data.content : "";
      if (!content) return state;
      const isFirst = state.thinkingStartMs === null;
      return {
        ...state,
        thinking: state.thinking + content,
        thinkingStartMs: isFirst
          ? mode === "replay"
            ? event.timestamp
            : nowMs
          : state.thinkingStartMs,
      };
    }

    case "thinking.done": {
      const content = typeof data.content === "string" ? data.content : "";
      const thinking = content || state.thinking;
      let duration = state.thinkingDuration;
      if (state.thinkingStartMs !== null) {
        const endMs = mode === "replay" ? event.timestamp : nowMs;
        duration = computeThinkingDuration(state.thinkingStartMs, endMs);
      }
      return { ...state, thinking, thinkingDuration: duration };
    }

    case "text.delta": {
      const content = typeof data.content === "string" ? data.content : "";
      if (!content) return state;
      return {
        ...state,
        assistantContent: state.assistantContent + content,
      };
    }

    case "text.done": {
      const content = typeof data.content === "string" ? data.content : "";
      if (!content) return state;
      return { ...state, assistantContent: content };
    }

    case "run.completed": {
      const response =
        typeof data.response === "string" ? data.response : undefined;
      const finalContent = state.assistantContent || response || "";
      return {
        ...state,
        assistantContent: finalContent,
        terminal: "completed",
      };
    }

    case "run.failed": {
      const error = typeof data.error === "string" ? data.error : "Run failed.";
      const fallback = `Error: ${error}`;
      return {
        ...state,
        assistantContent: state.assistantContent || fallback,
        terminal: "failed",
      };
    }

    case "run.cancelled": {
      const reason = typeof data.reason === "string" ? data.reason : "";
      const fallback = reason || "Run cancelled.";
      return {
        ...state,
        assistantContent: state.assistantContent || fallback,
        terminal: "cancelled",
      };
    }

    case "confirmation.required": {
      const confirmationID =
        typeof data.confirmationID === "string" ? data.confirmationID : "";
      if (!confirmationID) return state;
      const entry: PendingConfirmation = {
        confirmationID,
        actionName:
          typeof data.actionName === "string" ? data.actionName : "",
        args: (data.args as Record<string, unknown>) ?? {},
        message: typeof data.message === "string" ? data.message : "",
        threadID: event.threadID,
      };
      return {
        ...state,
        confirmations: [...state.confirmations, entry],
      };
    }

    case "confirmation.resolved": {
      const confirmationID =
        typeof data.confirmationID === "string" ? data.confirmationID : "";
      if (!confirmationID) return state;
      return {
        ...state,
        confirmations: state.confirmations.filter(
          (c) => c.confirmationID !== confirmationID,
        ),
      };
    }

    case "tool_call.started": {
      const toolCallID =
        typeof data.toolCallID === "string" ? data.toolCallID : "";
      const toolName =
        typeof data.toolName === "string" ? data.toolName : "";
      if (!toolCallID || !toolName) return state;
      const block: ToolCallBlock = {
        toolCallID,
        toolName,
        args: (data.args as Record<string, unknown>) ?? {},
        status: "started",
      };
      return { ...state, toolCalls: [...state.toolCalls, block] };
    }

    case "tool_call.executing": {
      const toolCallID =
        typeof data.toolCallID === "string" ? data.toolCallID : "";
      if (!toolCallID) return state;
      return {
        ...state,
        toolCalls: state.toolCalls.map((tc) =>
          tc.toolCallID === toolCallID ? { ...tc, status: "executing" } : tc,
        ),
      };
    }

    case "tool_call.result": {
      const toolCallID =
        typeof data.toolCallID === "string" ? data.toolCallID : "";
      if (!toolCallID) return state;
      return {
        ...state,
        toolCalls: state.toolCalls.map((tc) =>
          tc.toolCallID === toolCallID
            ? { ...tc, status: "completed", result: data.result }
            : tc,
        ),
      };
    }

    case "tool_call.error": {
      const toolCallID =
        typeof data.toolCallID === "string" ? data.toolCallID : "";
      if (!toolCallID) return state;
      const error = typeof data.error === "string" ? data.error : "";
      return {
        ...state,
        toolCalls: state.toolCalls.map((tc) =>
          tc.toolCallID === toolCallID
            ? { ...tc, status: "failed", error }
            : tc,
        ),
      };
    }

    case "subagent.spawned": {
      const toolCallID =
        typeof data.toolCallID === "string" ? data.toolCallID : "";
      if (!toolCallID) return state;
      return {
        ...state,
        toolCalls: state.toolCalls.map((tc) =>
          tc.toolCallID === toolCallID
            ? {
                ...tc,
                isSubagent: true,
                subagentMeta: {
                  runID:
                    typeof data.subagentRunID === "string"
                      ? data.subagentRunID
                      : "",
                  threadID:
                    typeof data.subagentThreadID === "string"
                      ? data.subagentThreadID
                      : "",
                  agentID:
                    typeof data.agentID === "string" ? data.agentID : "",
                  goal: typeof data.goal === "string" ? data.goal : "",
                },
              }
            : tc,
        ),
      };
    }

    default:
      return state;
  }
}

// Projects the stream state into the Message-shaped patch consumers apply
// via updateAssistantMessage(patch).
export function streamStateToMessagePatch(
  state: AgentStreamState,
): Partial<Message> {
  return {
    content: state.assistantContent,
    thinking: state.thinking || undefined,
    thinkingDuration: state.thinkingDuration,
    toolCalls: state.toolCalls.length > 0 ? state.toolCalls : undefined,
  };
}
