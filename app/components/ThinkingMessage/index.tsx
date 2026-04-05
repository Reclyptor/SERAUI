"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

function useProgressiveReveal(content: string, streaming: boolean): string {
  const targetRef = useRef(content);
  const indexRef = useRef(streaming ? 0 : content.length);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [display, setDisplay] = useState(streaming ? "" : content);

  targetRef.current = content;

  useEffect(() => {
    if (!streaming) {
      cancelAnimationFrame(rafRef.current);
      indexRef.current = targetRef.current.length;
      setDisplay(targetRef.current);
      return;
    }

    function tick(now: number) {
      const target = targetRef.current;
      const current = indexRef.current;

      if (current < target.length && now - lastTimeRef.current >= 30) {
        const behind = target.length - current;
        const step = Math.max(1, Math.ceil(behind / 6));
        const next = Math.min(current + step, target.length);
        indexRef.current = next;
        setDisplay(target.substring(0, next));
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [streaming]);

  return display;
}

const caretStyles = `
.streaming-caret > div > :last-child:is(p, h1, h2, h3, h4, h5, h6)::after,
.streaming-caret > div > :last-child:is(ul, ol) > li:last-child::after,
.streaming-caret > div > blockquote:last-child > :last-child::after,
.streaming-caret > div > pre:last-child code::after,
.streaming-caret > div > table:last-child tr:last-child td:last-child::after {
  content: " ▎";
  font-weight: 600;
  color: var(--color-accent);
  animation: pulse 0.8s steps(1) infinite;
}
`;

interface ThinkingMessageProps {
  content: string;
  thinking?: string;
  thinkingDuration?: number;
  isLoading?: boolean;
  isLatest?: boolean;
}

export function ThinkingMessage({
  content,
  thinking,
  thinkingDuration,
  isLoading,
  isLatest,
}: ThinkingMessageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const thinkingTextRef = useRef<HTMLSpanElement>(null);

  const isThinkingComplete = thinkingDuration != null;
  const displayContent = useProgressiveReveal(content, !!isLoading);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (!isThinkingComplete) return false;
    return !isLatest;
  });
  const responseComplete = !isLoading;
  const userToggledRef = useRef(false);

  const handleToggle = useCallback(() => {
    userToggledRef.current = true;
    setIsCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    if (userToggledRef.current) return;
    if (!isThinkingComplete) return;

    if (!isLatest) {
      setIsCollapsed(true);
    }
  }, [isThinkingComplete, isLatest]);

  useCharStream(thinking ?? "", isThinkingComplete, thinkingTextRef, scrollRef);

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

    return (
      <div className={isLoading ? "streaming-caret" : undefined}>
        {isLoading && <style>{caretStyles}</style>}
        <Markdown content={displayContent} />
      </div>
    );
  }

  const label = isThinkingComplete
    ? `Thought for ${thinkingDuration}s`
    : "Thinking...";

  const isStreaming = !isThinkingComplete;

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
                "mt-1 pl-3 max-h-[200px] text-[12px] text-foreground-muted/70 leading-relaxed",
                "overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words",
                "transition-[border-color] duration-300",
                isStreaming ? "border-l-2 border-l-accent" : "border-l border-l-border",
              ].join(" ")}
            >
              {isThinkingComplete ? (
                <span>{thinking}</span>
              ) : (
                <span ref={thinkingTextRef} />
              )}
            </div>
          </div>
        </div>
      </div>

      {content ? (
        <div className={!responseComplete ? "streaming-caret" : undefined}>
          {!responseComplete && <style>{caretStyles}</style>}
          <Markdown content={displayContent} />
        </div>
      ) : null}
    </div>
  );
}
