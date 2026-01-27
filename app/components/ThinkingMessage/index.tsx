"use client";

import { useState, useEffect, useRef } from "react";
import { Markdown } from "@copilotkit/react-ui";

interface ThinkingMessageProps {
  content: string;
  isLoading?: boolean;
}

export function ThinkingMessage({ content, isLoading }: ThinkingMessageProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [thinkingStartTime] = useState(Date.now());
  const [duration, setDuration] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Parse thinking and response (handle incomplete blocks during streaming)
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

  // Calculate duration and collapse when thinking completes
  useEffect(() => {
    if (isThinkingComplete && !duration) {
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
    return <Markdown content={content} />;
  }

  const label = isThinkingComplete 
    ? `Thought for ${duration}s`
    : 'Thinking...';

  return (
    <div className="space-y-4">
      <details open={ isOpen } onToggle={ (e) => setIsOpen(e.currentTarget.open) } className="mb-4">
        <summary className="flex items-center gap-1.5 py-1 cursor-pointer text-[11px] font-medium text-[#666666] hover:text-[#888888] transition-colors select-none list-none">
          <span className="inline-flex items-center justify-center w-2.5 h-2.5 text-[9px] leading-none transition-transform -mt-px" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}>▸</span>
          <span className="leading-none">{label}</span>
        </summary>
        <div 
          ref={scrollRef}
          className="mt-2 p-4 h-[100px] text-[11px] text-[#999999] font-mono leading-relaxed bg-[#252526] border border-[#3c3c3c] rounded-md overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words"
        >
          {thinking}
        </div>
      </details>
      {response && <Markdown content={response} />}
    </div>
  );
}
