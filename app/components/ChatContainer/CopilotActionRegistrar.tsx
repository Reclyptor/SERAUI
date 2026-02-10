"use client";

import { useCopilotAction } from "@copilotkit/react-core";

interface CopilotActionRegistrarProps {
  onOpenMediaOrganizer: () => void;
}

/**
 * Registers CopilotKit frontend actions that the AI agent can invoke.
 * Must be rendered inside a CopilotKit provider.
 */
export function CopilotActionRegistrar({
  onOpenMediaOrganizer,
}: CopilotActionRegistrarProps) {
  useCopilotAction({
    name: "openMediaOrganizer",
    description:
      "Opens the media organizer sidebar panel for the user to select anime series to process and organize into their Plex library",
    handler: async () => {
      onOpenMediaOrganizer();
      return "Media organizer panel opened. The user can now select a series to start a workflow.";
    },
  });

  return null;
}
