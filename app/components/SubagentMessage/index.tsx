"use client";

import { ChevronIcon, AgentIcon } from "../Icons";
import { Collapsible } from "../Collapsible";
import { useCollapsible } from "@/app/hooks/useCollapsible";
import type { ToolCallBlock } from "@/app/actions/chat";

interface SubagentMessageProps {
  toolCall: ToolCallBlock;
  isLatest?: boolean;
}

export function SubagentMessage({ toolCall, isLatest }: SubagentMessageProps) {
  const isActive =
    toolCall.status === "started" || toolCall.status === "executing";
  const isDone =
    toolCall.status === "completed" || toolCall.status === "failed";

  const { isCollapsed, toggle } = useCollapsible(isDone && !isLatest);

  const meta = toolCall.subagentMeta;
  const label = meta?.agentID || "Subagent";
  const goal = meta?.goal || "";

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 py-0.5 cursor-pointer text-[11px] font-medium text-foreground-muted hover:text-foreground transition-colors select-none"
      >
        <AgentIcon
          className={`w-2.5 h-2.5 flex-shrink-0 ${isActive ? "text-accent animate-pulse" : "text-foreground-muted/50"}`}
        />
        <ChevronIcon isOpen={!isCollapsed} className="w-2 h-2 -mt-px" />
        <span className={isActive ? "animate-pulse" : ""}>{label}</span>
        {toolCall.status === "failed" && (
          <span className="ml-1 rounded-full bg-red-500/10 px-1.5 py-px text-[10px] text-red-400">
            failed
          </span>
        )}
        {toolCall.status === "completed" && (
          <span className="ml-1 rounded-full bg-foreground-muted/10 px-1.5 py-px text-[10px] text-foreground-muted/60">
            done
          </span>
        )}
      </button>

      <Collapsible isOpen={!isCollapsed}>
        <div
          className={[
            "mt-0.5 ml-[7px] pl-3 text-[11px] leading-relaxed",
            "overflow-x-auto whitespace-pre-wrap break-words",
            "transition-[border-color] duration-300",
            isActive
              ? "border-l-2 border-l-accent"
              : "border-l border-l-border",
          ].join(" ")}
        >
          {goal && <p className="text-foreground-muted/60">{goal}</p>}
          {toolCall.result != null && (
            <pre className="text-foreground-muted/60 max-h-[200px] overflow-y-auto mt-1">
              {typeof toolCall.result === "string"
                ? toolCall.result
                : JSON.stringify(toolCall.result, null, 2)}
            </pre>
          )}
          {toolCall.error && (
            <pre className="text-red-400/80 max-h-[120px] overflow-y-auto mt-1">
              {toolCall.error}
            </pre>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
