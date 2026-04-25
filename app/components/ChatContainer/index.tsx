"use client";

import { useRef } from "react";
import { SeraChat } from "../SeraChat";
import { useChat } from "../../contexts/ChatContext";
import type { Message } from "@/app/actions/chat";

interface ChatContainerProps {
  chatID: string | null;
  initialMessages: Message[];
  initialModel?: string;
}

export function ChatContainer({
  chatID,
  initialMessages,
  initialModel,
}: ChatContainerProps) {
  const appendMessageRef = useRef<(msg: Message) => void>(undefined);
  const { sessionId } = useChat();

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 min-w-0">
        <SeraChat
          key={sessionId}
          chatID={chatID}
          initialMessages={initialMessages}
          initialModel={initialModel}
          appendMessageRef={appendMessageRef}
        />
      </div>
    </div>
  );
}
