import { describe, it, expect } from "vitest";
import {
  buildStreamURL,
  computeThinkingDuration,
  emptyStreamState,
  reduceAgentEvent,
  streamStateToMessagePatch,
  type AgentEvent,
  type AgentStreamState,
} from "./agentEvents";

function event(
  type: string,
  data: unknown = {},
  overrides: Partial<AgentEvent> = {},
): AgentEvent {
  return {
    type,
    runID: "run-1",
    threadID: "thread-1",
    timestamp: 1_000_000,
    data,
    ...overrides,
  };
}

const reduce = (
  state: AgentStreamState,
  ev: AgentEvent,
  mode: "live" | "replay" = "live",
  nowMs = 2_000_000,
) => reduceAgentEvent(state, ev, { mode, nowMs });

describe("computeThinkingDuration", () => {
  it("rounds to the nearest second", () => {
    expect(computeThinkingDuration(0, 1499)).toBe(1);
    expect(computeThinkingDuration(0, 1500)).toBe(2);
  });

  it("floors at 1 second for sub-second thinking", () => {
    expect(computeThinkingDuration(0, 100)).toBe(1);
    expect(computeThinkingDuration(0, 0)).toBe(1);
  });
});

describe("buildStreamURL", () => {
  it("omits the query when cursor is null or '0'", () => {
    expect(buildStreamURL("run-a", null)).toBe("/api/v1/agent/stream/run-a");
    expect(buildStreamURL("run-a", "0")).toBe("/api/v1/agent/stream/run-a");
  });

  it("URL-encodes both runID and cursor", () => {
    expect(buildStreamURL("run/123", "abc def"))
      .toBe("/api/v1/agent/stream/run%2F123?last-event-id=abc%20def");
  });
});

describe("reduceAgentEvent — text", () => {
  it("appends text.delta to assistantContent", () => {
    let s = emptyStreamState();
    s = reduce(s, event("text.delta", { content: "Hel" }));
    s = reduce(s, event("text.delta", { content: "lo" }));
    expect(s.assistantContent).toBe("Hello");
  });

  it("text.done replaces content when non-empty", () => {
    let s = emptyStreamState();
    s = reduce(s, event("text.delta", { content: "Wrong" }));
    s = reduce(s, event("text.done", { content: "Right" }));
    expect(s.assistantContent).toBe("Right");
  });

  it("text.done with empty content keeps accumulated content", () => {
    let s = emptyStreamState();
    s = reduce(s, event("text.delta", { content: "Keep" }));
    s = reduce(s, event("text.done", { content: "" }));
    expect(s.assistantContent).toBe("Keep");
  });

  it("ignores text.delta with missing/non-string content", () => {
    let s = emptyStreamState();
    s = reduce(s, event("text.delta", {}));
    s = reduce(s, event("text.delta", { content: 42 }));
    expect(s.assistantContent).toBe("");
  });
});

describe("reduceAgentEvent — thinking", () => {
  it("starts the thinking timer on first delta in live mode", () => {
    let s = emptyStreamState();
    s = reduce(s, event("thinking.delta", { content: "Hmm" }), "live", 5_000);
    expect(s.thinking).toBe("Hmm");
    expect(s.thinkingStartMs).toBe(5_000);
  });

  it("uses event.timestamp as start time in replay mode", () => {
    let s = emptyStreamState();
    s = reduce(
      s,
      event("thinking.delta", { content: "Hmm" }, { timestamp: 12345 }),
      "replay",
    );
    expect(s.thinkingStartMs).toBe(12345);
  });

  it("does not reset start time on subsequent deltas", () => {
    let s = emptyStreamState();
    s = reduce(s, event("thinking.delta", { content: "A" }), "live", 5_000);
    s = reduce(s, event("thinking.delta", { content: "B" }), "live", 9_000);
    expect(s.thinkingStartMs).toBe(5_000);
    expect(s.thinking).toBe("AB");
  });

  it("computes thinkingDuration on thinking.done in live mode", () => {
    let s = emptyStreamState();
    s = reduce(s, event("thinking.delta", { content: "X" }), "live", 1_000);
    s = reduce(s, event("thinking.done", { content: "Final" }), "live", 4_500);
    expect(s.thinking).toBe("Final");
    expect(s.thinkingDuration).toBe(4);
  });

  it("uses event.timestamp for duration in replay mode", () => {
    let s = emptyStreamState();
    s = reduce(
      s,
      event("thinking.delta", { content: "X" }, { timestamp: 1_000 }),
      "replay",
    );
    s = reduce(
      s,
      event("thinking.done", { content: "Final" }, { timestamp: 4_000 }),
      "replay",
    );
    expect(s.thinkingDuration).toBe(3);
  });

  it("renders sub-second thinking as 1s (no Thought for 0s)", () => {
    let s = emptyStreamState();
    s = reduce(s, event("thinking.delta", { content: "X" }), "live", 1_000);
    s = reduce(s, event("thinking.done", { content: "Done" }), "live", 1_100);
    expect(s.thinkingDuration).toBe(1);
  });
});

describe("reduceAgentEvent — terminal events", () => {
  it("run.completed backfills assistantContent from data.response when empty", () => {
    const s = reduce(
      emptyStreamState(),
      event("run.completed", { response: "Hello world" }),
    );
    expect(s.assistantContent).toBe("Hello world");
    expect(s.terminal).toBe("completed");
  });

  it("run.completed preserves accumulated content even if response is provided", () => {
    let s = emptyStreamState();
    s = reduce(s, event("text.delta", { content: "Streamed" }));
    s = reduce(s, event("run.completed", { response: "Backfill" }));
    expect(s.assistantContent).toBe("Streamed");
  });

  it("run.failed writes Error: <error> when content is empty", () => {
    const s = reduce(
      emptyStreamState(),
      event("run.failed", { error: "boom" }),
    );
    expect(s.assistantContent).toBe("Error: boom");
    expect(s.terminal).toBe("failed");
  });

  it("run.failed uses generic message when error is missing", () => {
    const s = reduce(emptyStreamState(), event("run.failed", {}));
    expect(s.assistantContent).toBe("Error: Run failed.");
  });

  it("run.cancelled prefers reason then falls back to Run cancelled.", () => {
    expect(
      reduce(emptyStreamState(), event("run.cancelled", { reason: "user stop" }))
        .assistantContent,
    ).toBe("user stop");
    expect(
      reduce(emptyStreamState(), event("run.cancelled", {})).assistantContent,
    ).toBe("Run cancelled.");
  });

  it("terminal events do not overwrite an already-set assistantContent fallback", () => {
    let s = emptyStreamState();
    s = reduce(s, event("text.delta", { content: "Real reply" }));
    s = reduce(s, event("run.failed", { error: "ignored" }));
    expect(s.assistantContent).toBe("Real reply");
  });
});

describe("reduceAgentEvent — confirmations", () => {
  it("appends confirmation.required with threadID from envelope", () => {
    const s = reduce(
      emptyStreamState(),
      event(
        "confirmation.required",
        {
          confirmationID: "c1",
          actionName: "approve",
          args: { x: 1 },
          message: "ok?",
        },
        { threadID: "thread-9" },
      ),
    );
    expect(s.confirmations).toHaveLength(1);
    expect(s.confirmations[0]).toEqual({
      confirmationID: "c1",
      actionName: "approve",
      args: { x: 1 },
      message: "ok?",
      threadID: "thread-9",
    });
  });

  it("removes the matching id on confirmation.resolved", () => {
    let s = emptyStreamState();
    s = reduce(s, event("confirmation.required", { confirmationID: "a" }));
    s = reduce(s, event("confirmation.required", { confirmationID: "b" }));
    s = reduce(s, event("confirmation.resolved", { confirmationID: "a" }));
    expect(s.confirmations.map((c) => c.confirmationID)).toEqual(["b"]);
  });

  it("ignores confirmation events without an id", () => {
    let s = emptyStreamState();
    s = reduce(s, event("confirmation.required", {}));
    s = reduce(s, event("confirmation.resolved", {}));
    expect(s.confirmations).toEqual([]);
  });

  it("appends approval.requested (tool-layer) the same as confirmation.required", () => {
    const s = reduce(
      emptyStreamState(),
      event(
        "approval.requested",
        {
          confirmationID: "approve-1",
          actionName: "cluster_git.write_file",
          args: { path: "apps/x.yaml" },
          message: "Approval required to commit apps/x.yaml",
        },
        { threadID: "thread-42" },
      ),
    );
    expect(s.confirmations).toEqual([
      {
        confirmationID: "approve-1",
        actionName: "cluster_git.write_file",
        args: { path: "apps/x.yaml" },
        message: "Approval required to commit apps/x.yaml",
        threadID: "thread-42",
      },
    ]);
  });

  it("removes the matching id on approval.resolved", () => {
    let s = emptyStreamState();
    s = reduce(s, event("approval.requested", { confirmationID: "k1" }));
    s = reduce(s, event("approval.resolved", { confirmationID: "k1" }));
    expect(s.confirmations).toEqual([]);
  });

  it("removes the matching id on approval.expired", () => {
    let s = emptyStreamState();
    s = reduce(s, event("approval.requested", { confirmationID: "k2" }));
    s = reduce(s, event("approval.expired", { confirmationID: "k2" }));
    expect(s.confirmations).toEqual([]);
  });

  it("dedupes when both confirmation.required and approval.requested fire for the same id", () => {
    // Defensive: backend currently fires only one channel on insert, but
    // SPEC §12 leaves the unified-store open to both emitting. Reducer
    // must not show the same prompt twice.
    let s = emptyStreamState();
    s = reduce(
      s,
      event("confirmation.required", {
        confirmationID: "shared",
        actionName: "exec",
        message: "approve?",
      }),
    );
    s = reduce(
      s,
      event("approval.requested", {
        confirmationID: "shared",
        actionName: "exec",
        message: "approve?",
      }),
    );
    expect(s.confirmations).toHaveLength(1);
    expect(s.confirmations[0].confirmationID).toBe("shared");
  });

  it("tolerates the paired confirmation.resolved + approval.resolved that the backend fires on transition", () => {
    let s = emptyStreamState();
    s = reduce(s, event("approval.requested", { confirmationID: "x" }));
    s = reduce(s, event("confirmation.resolved", { confirmationID: "x" }));
    s = reduce(s, event("approval.resolved", { confirmationID: "x" }));
    expect(s.confirmations).toEqual([]);
  });
});

describe("reduceAgentEvent — tool calls", () => {
  it("appends tool_call.started", () => {
    const s = reduce(
      emptyStreamState(),
      event("tool_call.started", {
        toolCallID: "t1",
        toolName: "search",
        args: { q: "x" },
      }),
    );
    expect(s.toolCalls).toEqual([
      { toolCallID: "t1", toolName: "search", args: { q: "x" }, status: "started" },
    ]);
  });

  it("flips status: started → executing → completed", () => {
    let s = emptyStreamState();
    s = reduce(s, event("tool_call.started", { toolCallID: "t1", toolName: "x" }));
    s = reduce(s, event("tool_call.executing", { toolCallID: "t1" }));
    s = reduce(s, event("tool_call.result", { toolCallID: "t1", result: { ok: true } }));
    expect(s.toolCalls[0].status).toBe("completed");
    expect(s.toolCalls[0].result).toEqual({ ok: true });
  });

  it("tool_call.error sets failed + error string", () => {
    let s = emptyStreamState();
    s = reduce(s, event("tool_call.started", { toolCallID: "t1", toolName: "x" }));
    s = reduce(s, event("tool_call.error", { toolCallID: "t1", error: "timeout" }));
    expect(s.toolCalls[0]).toMatchObject({ status: "failed", error: "timeout" });
  });

  it("ignores tool events with missing toolCallID", () => {
    const s = reduce(emptyStreamState(), event("tool_call.started", { toolName: "x" }));
    expect(s.toolCalls).toEqual([]);
  });

  it("subagent.spawned tags the matching tool call", () => {
    let s = emptyStreamState();
    s = reduce(s, event("tool_call.started", { toolCallID: "t1", toolName: "x" }));
    s = reduce(
      s,
      event("subagent.spawned", {
        toolCallID: "t1",
        subagentRunID: "sr1",
        subagentThreadID: "st1",
        agentID: "research",
        goal: "find docs",
      }),
    );
    expect(s.toolCalls[0].isSubagent).toBe(true);
    expect(s.toolCalls[0].subagentMeta).toEqual({
      runID: "sr1",
      threadID: "st1",
      agentID: "research",
      goal: "find docs",
    });
  });
});

describe("reduceAgentEvent — ignored events", () => {
  it.each([
    "subagent.completed",
    "subagent.failed",
    "plan.created",
    "plan.step_updated",
    "evaluation.done",
    "error",
    "unknown.event.type",
  ])("returns state unchanged for %s", (type) => {
    const s = emptyStreamState();
    expect(reduce(s, event(type))).toBe(s);
  });
});

describe("streamStateToMessagePatch", () => {
  it("omits empty thinking and zero-length toolCalls", () => {
    const patch = streamStateToMessagePatch(emptyStreamState());
    expect(patch).toEqual({
      content: "",
      thinking: undefined,
      thinkingDuration: undefined,
      toolCalls: undefined,
    });
  });

  it("includes accumulated fields", () => {
    let s = emptyStreamState();
    s = reduce(s, event("text.delta", { content: "Hi" }));
    s = reduce(s, event("thinking.delta", { content: "Thinking" }));
    s = reduce(s, event("tool_call.started", { toolCallID: "t", toolName: "x" }));
    const patch = streamStateToMessagePatch(s);
    expect(patch.content).toBe("Hi");
    expect(patch.thinking).toBe("Thinking");
    expect(patch.toolCalls).toHaveLength(1);
  });
});
