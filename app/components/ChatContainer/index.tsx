"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { useMemo } from "react";
import { SeraChat } from "../SeraChat";
import type { Message } from "@/app/actions/chat";

interface ChatContainerProps {
  chatID: string | null;
  initialMessages: Message[];
  accessToken: string;
  runtimeUrl: string;
}

export function ChatContainer({ chatID, initialMessages, accessToken, runtimeUrl }: ChatContainerProps) {
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  return (
    <CopilotKit
      runtimeUrl={runtimeUrl}
      agent="SERA"
      headers={headers}
    >
      <SeraChat chatID={chatID} initialMessages={initialMessages} />
    </CopilotKit>
  );
}
