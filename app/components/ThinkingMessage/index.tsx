"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Markdown } from "../Markdown";
import { ChevronIcon } from "../Icons";

function useCharStream(
  target: string,
  flushed: boolean,
  nodeRef: React.RefObject<HTMLSpanElement | null>,
  scrollContainerRef?: React.RefObject<HTMLElement | null>,
) {
  const targetRef = useRef(target);
  const indexRef = useRef(flushed ? target.length : 0);
  const rafRef = useRef<number>(0);

  targetRef.current = target;

  useEffect(() => {
    if (flushed) {
      cancelAnimationFrame(rafRef.current);
      if (nodeRef.current) {
        nodeRef.current.textContent = targetRef.current;
      }
      indexRef.current = targetRef.current.length;
      return;
    }

    function tick() {
      const node = nodeRef.current;
      if (!node) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const t = targetRef.current;
      const i = indexRef.current;

      if (i < t.length) {
        const next = i + 1;
        indexRef.current = next;
        node.textContent = t.substring(0, next);

        const sc = scrollContainerRef?.current;
        if (sc) {
          sc.scrollTop = sc.scrollHeight;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [flushed, nodeRef, scrollContainerRef]);
}

function BlinkingCaret() {
  return (
    <span
      className="inline font-semibold text-accent"
      style={{ animation: "pulse 0.8s steps(1) infinite" }}
    >
      ▎
    </span>
  );
}

interface ThinkingMessageProps {
  content: string;
  isLoading?: boolean;
}

export function ThinkingMessage({ content, isLoading }: ThinkingMessageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const thinkingTextRef = useRef<HTMLSpanElement>(null);
  const responseTextRef = useRef<HTMLSpanElement>(null);

  const { thinking, response, isThinkingComplete, embeddedDuration } = useMemo(() => {
    const tagMatch = content.match(/\[THINKING(?::(\d+))?\]\n/);
    const thinkingEnd = content.indexOf("\n[/THINKING]");

    let thinking: string | null = null;
    let response = content;
    const isThinkingComplete = thinkingEnd !== -1;
    let embeddedDuration: number | null = null;

    if (tagMatch) {
      const tagLength = tagMatch[0].length;
      const tagStart = tagMatch.index!;

      if (tagMatch[1] != null) {
        embeddedDuration = parseInt(tagMatch[1], 10);
      }

      if (isThinkingComplete) {
        thinking = content.substring(tagStart + tagLength, thinkingEnd);
        response = content.substring(thinkingEnd + 13);
      } else {
        thinking = content.substring(tagStart + tagLength);
        response = "";
      }
    }

    return { thinking, response, isThinkingComplete, embeddedDuration };
  }, [content]);

  const [isOpen, setIsOpen] = useState(() => !isThinkingComplete);
  const [isCollapsed, setIsCollapsed] = useState(isThinkingComplete);
  const responseComplete = !isLoading;

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    setIsCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isThinkingComplete && isOpen) {
      setIsCollapsed(true);
      setIsOpen(false);
    }
  }, [isThinkingComplete]);

  useCharStream(thinking ?? "", isThinkingComplete, thinkingTextRef, scrollRef);
  useCharStream(response, responseComplete, responseTextRef);

  if (!thinking) {
    if (!content && isLoading) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 py-1 text-[11px] font-medium text-foreground-muted select-none">
            <ChevronIcon isOpen={true} className="w-2.5 h-2.5 -mt-px" />
            <span className="leading-none animate-pulse">Thinking...</span>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap break-words">
          <span ref={responseTextRef} />
          <BlinkingCaret />
        </div>
      );
    }

    return <Markdown content={content} />;
  }

  const label = isThinkingComplete
    ? `Thought for ${embeddedDuration ?? 0}s`
    : "Thinking...";

  const isStreaming = !isThinkingComplete;
  const isResponseStreaming = isThinkingComplete && !responseComplete;

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1.5 py-1 cursor-pointer text-[11px] font-medium text-foreground-muted hover:text-foreground transition-colors select-none"
        >
          <ChevronIcon isOpen={!isCollapsed} className="w-2.5 h-2.5 -mt-px" />
          <span className={`leading-none ${isStreaming ? "animate-pulse" : ""}`}>
            {label}
          </span>
        </button>

        <div
          className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
          style={{ gridTemplateRows: isCollapsed ? "0fr" : "1fr" }}
        >
          <div className="overflow-hidden min-h-0">
            <div
              ref={scrollRef}
              className={[
                "mt-2 p-4 h-[100px] text-[11px] text-foreground-muted font-mono leading-relaxed",
                "bg-background-secondary rounded-md overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words",
                "transition-[border-color] duration-300",
                isStreaming ? "border-l-2 border-l-accent border border-border" : "border border-border",
              ].join(" ")}
            >
              <span ref={thinkingTextRef} />
            </div>
          </div>
        </div>
      </div>

      {responseComplete ? (
        response ? <Markdown content={response} /> : null
      ) : isResponseStreaming ? (
        <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap break-words">
          <span ref={responseTextRef} />
          <BlinkingCaret />
        </div>
      ) : null}
    </div>
  );
}
