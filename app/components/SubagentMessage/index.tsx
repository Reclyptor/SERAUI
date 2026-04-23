"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronIcon, AgentIcon } from "../Icons";
import type { ToolCallBlock } from "@/app/actions/chat";

interface SubagentMessageProps {
  toolCall: ToolCallBlock;
  isLatest?: boolean;
}

export function SubagentMessage({ toolCall, isLatest }: SubagentMessageProps) {
  const isActive = toolCall.status === "started" || toolCall.status === "executing";
  const isDone = toolCall.status === "completed" || toolCall.status === "failed";

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (!isDone) return false;
    return !isLatest;
  });
  const userToggledRef = useRef(false);

  const handleToggle = useCallback(() => {
    userToggledRef.current = true;
    setIsCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    if (userToggledRef.current) return;
    if (!isDone) return;
    if (!isLatest) setIsCollapsed(true);
  }, [isDone, isLatest]);

  const meta = toolCall.subagentMeta;
  const label = meta?.agentID || "Subagent";
  const goal = meta?.goal || "";

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 py-0.5 cursor-pointer text-[11px] font-medium text-foreground-muted hover:text-foreground transition-colors select-none"
      >
        <AgentIcon className={`w-2.5 h-2.5 flex-shrink-0 ${isActive ? "text-accent animate-pulse" : "text-foreground-muted/50"}`} />
        <ChevronIcon isOpen={!isCollapsed} className="w-2 h-2 -mt-px" />
        <span className={isActive ? "animate-pulse" : ""}>
          {label}
        </span>
        {toolCall.status === "failed" && (
          <span className="text-red-400 ml-1">failed</span>
        )}
        {toolCall.status === "completed" && (
          <span className="text-foreground-muted/40 ml-1">done</span>
        )}
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className={[
              "mt-0.5 ml-[7px] pl-3 text-[11px] leading-relaxed",
              "overflow-x-auto whitespace-pre-wrap break-words",
              "transition-[border-color] duration-300",
              isActive ? "border-l-2 border-l-accent" : "border-l border-l-border",
            ].join(" ")}
          >
            {goal && (
              <p className="text-foreground-muted/60">{goal}</p>
            )}
            {toolCall.result != null && (
              <pre className="text-foreground-muted/60 max-h-[200px] overflow-y-auto mt-1">
                {typeof toolCall.result === "string"
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            )}
            {toolCall.error && (
              <pre className="text-red-400/80 max-h-[120px] overflow-y-auto mt-1">{toolCall.error}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
