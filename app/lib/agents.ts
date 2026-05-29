import type { AgentConfig } from "@/app/actions/agents";

export interface AgentOption {
  agentID: string;
  name: string;
  description?: string;
}

export function toAgentOptions(agents: AgentConfig[]): AgentOption[] {
  return agents
    .filter((a) => a.enabled !== false)
    .map((a) => ({
      agentID: a.agentID,
      name: a.name,
      description: a.description,
    }));
}

export function getAgentDisplayName(
  agents: AgentOption[],
  agentID: string | null | undefined,
): string {
  if (!agentID) return "Default agent";
  return agents.find((a) => a.agentID === agentID)?.name ?? agentID;
}
