"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { listAgents } from "@/app/actions/agents";
import {
  getAgentDisplayName,
  toAgentOptions,
  type AgentOption,
} from "@/app/lib/agents";
import { useClickOutside } from "@/app/hooks/useClickOutside";
import { ChevronUpDownIcon } from "../Icons";

interface AgentSelectorProps {
  selectedAgentID: string | null;
  onAgentChange: (agentID: string | null) => void;
  disabled?: boolean;
}

export function AgentSelector({
  selectedAgentID,
  onAgentChange,
  disabled,
}: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, isOpen, () => setIsOpen(false));

  useEffect(() => {
    let cancelled = false;
    listAgents()
      .then((list) => {
        if (!cancelled) setAgents(toAgentOptions(list));
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = getAgentDisplayName(agents, selectedAgentID);

  return (
    <div ref={menuRef} className="relative">
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-56 max-h-64 overflow-y-auto bg-background-secondary border border-border rounded-xl shadow-lg py-1 z-50">
          <button
            onClick={() => {
              onAgentChange(null);
              setIsOpen(false);
            }}
            className={clsx(
              "w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer",
              selectedAgentID === null
                ? "text-accent bg-accent-muted"
                : "text-foreground hover:bg-background-tertiary",
            )}
          >
            Default agent
          </button>
          {agents.map((agent) => (
            <button
              key={agent.agentID}
              onClick={() => {
                onAgentChange(agent.agentID);
                setIsOpen(false);
              }}
              className={clsx(
                "w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer",
                agent.agentID === selectedAgentID
                  ? "text-accent bg-accent-muted"
                  : "text-foreground hover:bg-background-tertiary",
              )}
              title={agent.description}
            >
              {agent.name}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer",
          "text-foreground-muted hover:text-foreground hover:bg-background-tertiary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        <span>{displayName}</span>
        <ChevronUpDownIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
