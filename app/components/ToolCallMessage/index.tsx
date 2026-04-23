"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronIcon, DotIcon } from "../Icons";
import type { ToolCallBlock } from "@/app/actions/chat";

interface ToolCallMessageProps {
  toolCall: ToolCallBlock;
  isLatest?: boolean;
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  if (entries.length === 1) {
    const [key, value] = entries[0];
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= 120) return `${key}: ${str}`;
  }
  return JSON.stringify(args, null, 2);
}

function formatResult(result: unknown): string {
  if (result == null) return "";
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
}

export function ToolCallMessage({ toolCall, isLatest }: ToolCallMessageProps) {
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

  const argsStr = formatArgs(toolCall.args);
  const resultStr = toolCall.result != null ? formatResult(toolCall.result) : null;
  const hasDetail = argsStr || resultStr || toolCall.error;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 py-0.5 cursor-pointer text-[11px] font-medium text-foreground-muted hover:text-foreground transition-colors select-none"
      >
        <DotIcon className={`w-1.5 h-1.5 flex-shrink-0 ${isActive ? "text-accent animate-pulse" : "text-foreground-muted/50"}`} />
        <ChevronIcon isOpen={!isCollapsed} className="w-2 h-2 -mt-px" />
        <span className={isActive ? "animate-pulse" : ""}>
          {toolCall.toolName}
        </span>
        {toolCall.status === "failed" && (
          <span className="text-red-400 ml-1">failed</span>
        )}
      </button>

      {hasDetail && (
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
              {argsStr && (
                <pre className="text-foreground-muted/60 max-h-[120px] overflow-y-auto">{argsStr}</pre>
              )}
              {resultStr && (
                <pre className="text-foreground-muted/60 max-h-[200px] overflow-y-auto mt-1">{resultStr}</pre>
              )}
              {toolCall.error && (
                <pre className="text-red-400/80 max-h-[120px] overflow-y-auto mt-1">{toolCall.error}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
