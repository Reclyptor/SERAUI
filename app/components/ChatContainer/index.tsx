"use client";

import { useState, useCallback } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { SeraChat } from "../SeraChat";
import { WorkflowSidebar } from "../WorkflowSidebar";
import { CopilotActionRegistrar } from "./CopilotActionRegistrar";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  return (
    <CopilotKit runtimeUrl="/api/v1/copilotkit" agent="SERA">
      <CopilotActionRegistrar onOpenMediaOrganizer={openSidebar} />
      <div className="flex h-full w-full">
        <div className="flex-1 min-w-0">
          <SeraChat
            chatID={chatID}
            initialMessages={initialMessages}
            initialWorkflowState={initialWorkflowState}
          />
        </div>
        <WorkflowSidebar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
          chatID={chatID}
        />
      </div>
    </CopilotKit>
  );
}
