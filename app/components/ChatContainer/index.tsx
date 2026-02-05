"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { SeraChat } from "../SeraChat";
import type { Message } from "@/app/actions/chat";

interface ChatContainerProps {
  chatID: string | null;
  initialMessages: Message[];
}

export function ChatContainer({ chatID, initialMessages }: ChatContainerProps) {
  // Use local API route that proxies to backend with server-side auth
  // This keeps access tokens out of the browser entirely
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="SERA"
    >
      <SeraChat chatID={chatID} initialMessages={initialMessages} />
    </CopilotKit>
  );
}
