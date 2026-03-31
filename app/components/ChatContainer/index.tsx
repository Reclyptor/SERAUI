"use client";

import { useRef } from "react";
import { SeraChat } from "../SeraChat";
import type { Message } from "@/app/actions/chat";

interface ChatContainerProps {
  chatID: string | null;
  initialMessages: Message[];
}

export function ChatContainer({
  chatID,
  initialMessages,
}: ChatContainerProps) {
  const appendMessageRef = useRef<(msg: Message) => void>(undefined);

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 min-w-0">
        <SeraChat
          chatID={chatID}
          initialMessages={initialMessages}
          appendMessageRef={appendMessageRef}
        />
      </div>
    </div>
  );
}
