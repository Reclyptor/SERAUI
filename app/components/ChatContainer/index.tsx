"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { SeraChat } from "../SeraChat";
import type { Message } from "@/app/actions/chat";
import type { PersistedWorkflowState } from "@/app/contexts/WorkflowContext";

interface ChatContainerProps {
  chatID: string | null;
  initialMessages: Message[];
  initialWorkflowState?: PersistedWorkflowState[];
}

export function ChatContainer({
  chatID,
  initialMessages,
  initialWorkflowState = [],
}: ChatContainerProps) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="SERA">
      <SeraChat
        chatID={chatID}
        initialMessages={initialMessages}
        initialWorkflowState={initialWorkflowState}
      />
    </CopilotKit>
  );
}
