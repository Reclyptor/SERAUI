"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Markdown } from "@copilotkit/react-ui";
import { ChevronIcon } from "../Icons";

interface ThinkingMessageProps {
  content: string;
  isLoading?: boolean;
}

export function ThinkingMessage({ content, isLoading }: ThinkingMessageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Parse thinking and response (handle incomplete blocks during streaming)
  const { thinking, response, isThinkingComplete } = useMemo(() => {
    const thinkingStart = content.indexOf('[THINKING]\n');
    const thinkingEnd = content.indexOf('\n[/THINKING]');
    
    let thinking: string | null = null;
    let response = content;
    const isThinkingComplete = thinkingEnd !== -1;
    
    if (thinkingStart !== -1) {
      if (isThinkingComplete) {
        // Complete thinking block
        thinking = content.substring(thinkingStart + 11, thinkingEnd);
        response = content.substring(thinkingEnd + 13);
      } else {
        // Incomplete thinking block (still streaming)
        thinking = content.substring(thinkingStart + 11);
        response = '';
      }
    }
    
    return { thinking, response, isThinkingComplete };
  }, [content]);

  // Initialize isOpen based on whether thinking is already complete
  // If loading an existing message with complete thinking, start closed
  const [isOpen, setIsOpen] = useState(() => !isThinkingComplete);
  const [thinkingStartTime] = useState(Date.now());
  const [duration, setDuration] = useState<number | null>(() => 
    isThinkingComplete ? 0 : null
  );

  // Collapse when thinking completes during streaming
  useEffect(() => {
    if (isThinkingComplete && duration === null) {
      const elapsed = Math.round((Date.now() - thinkingStartTime) / 1000);
      setDuration(elapsed);
      setIsOpen(false);
    }
  }, [isThinkingComplete, duration, thinkingStartTime]);

  // Auto-scroll thinking while streaming
  useEffect(() => {
    if (scrollRef.current && !isThinkingComplete) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isThinkingComplete]);

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
    return <Markdown content={content} />;
  }

  const label = isThinkingComplete 
    ? `Thought for ${duration}s`
    : 'Thinking...';

  return (
    <div className="space-y-4">
      <details open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)} className="mb-4">
        <summary className="flex items-center gap-1.5 py-1 cursor-pointer text-[11px] font-medium text-foreground-muted hover:text-foreground transition-colors select-none list-none">
          <ChevronIcon isOpen={isOpen} className="w-2.5 h-2.5 -mt-px" />
          <span className={`leading-none ${!isThinkingComplete ? 'animate-pulse' : ''}`}>{label}</span>
        </summary>
        <div 
          ref={scrollRef}
          className="mt-2 p-4 h-[100px] text-[11px] text-foreground-muted font-mono leading-relaxed bg-background-secondary border border-border rounded-md overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words"
        >
          {thinking}
        </div>
      </details>
      {response && <Markdown content={response} />}
    </div>
  );
}
