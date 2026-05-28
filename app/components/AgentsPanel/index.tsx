"use client";

import clsx from "clsx";
import {
  ManagePanel,
  Field,
  Section,
  Toggle,
  inputClass,
  type ManagePanelEditorProps,
} from "../ManagePanel";
import {
  listAgents,
  getAgent,
  saveAgent,
  createAgent,
  deleteAgent,
  type AgentConfig,
  type AgentCreateInput,
  type AgentUpdateInput,
  type SandboxConfig,
} from "@/app/actions/agents";

type Draft = Omit<AgentConfig, "createdAt" | "updatedAt">;

function newSandbox(): SandboxConfig {
  return {
    enabled: false,
    image: "node:20-slim",
    memoryMb: 512,
    cpuShares: 1024,
    networkEnabled: false,
    envVars: {},
  };
}

// Factory (not a shared constant) so nested arrays/objects aren't aliased
// across "New" clicks.
function newAgentDraft(): Draft {
  return {
    agentID: "",
    name: "",
    description: "",
    promptSlug: "",
    enabled: true,
    modelOptions: {
      preferredProvider: "",
      preferredModel: "",
      maxOutputTokens: undefined,
      temperature: undefined,
    },
    toolPolicy: { mode: "deny", tools: [] },
    messagingPolicy: { enabled: false, allowedAgents: [] },
    sandboxConfig: newSandbox(),
  };
}

function toDraft(agent: AgentConfig): Draft {
  return {
    agentID: agent.agentID,
    name: agent.name,
    description: agent.description,
    promptSlug: agent.promptSlug ?? "",
    enabled: agent.enabled,
    modelOptions: {
      preferredProvider: agent.modelOptions?.preferredProvider ?? "",
      preferredModel: agent.modelOptions?.preferredModel ?? "",
      maxOutputTokens: agent.modelOptions?.maxOutputTokens,
      temperature: agent.modelOptions?.temperature,
    },
    toolPolicy: {
      mode: agent.toolPolicy?.mode ?? "deny",
      tools: agent.toolPolicy?.tools ?? [],
    },
    messagingPolicy: {
      enabled: agent.messagingPolicy?.enabled ?? false,
      allowedAgents: agent.messagingPolicy?.allowedAgents ?? [],
    },
    sandboxConfig: {
      enabled: agent.sandboxConfig?.enabled ?? false,
      image: agent.sandboxConfig?.image ?? "node:20-slim",
      memoryMb: agent.sandboxConfig?.memoryMb ?? 512,
      cpuShares: agent.sandboxConfig?.cpuShares ?? 1024,
      networkEnabled: agent.sandboxConfig?.networkEnabled ?? false,
      envVars: agent.sandboxConfig?.envVars ?? {},
    },
  };
}

function draftToUpdate(d: Draft): AgentUpdateInput {
  return {
    name: d.name,
    description: d.description,
    promptSlug: d.promptSlug || undefined,
    modelOptions: {
      preferredProvider: d.modelOptions?.preferredProvider || undefined,
      preferredModel: d.modelOptions?.preferredModel || undefined,
      maxOutputTokens: d.modelOptions?.maxOutputTokens,
      temperature: d.modelOptions?.temperature,
    },
    toolPolicy: d.toolPolicy,
    messagingPolicy: d.messagingPolicy,
    sandboxConfig: d.sandboxConfig,
    enabled: d.enabled,
  };
}

function draftToCreate(d: Draft): AgentCreateInput {
  return {
    agentID: d.agentID,
    name: d.name,
    description: d.description,
    promptSlug: d.promptSlug || undefined,
    modelOptions: draftToUpdate(d).modelOptions,
    toolPolicy: d.toolPolicy,
    messagingPolicy: d.messagingPolicy,
    sandboxConfig: d.sandboxConfig,
    enabled: d.enabled,
  };
}

export function AgentsPanel() {
  return (
    <ManagePanel<AgentConfig, Draft, AgentCreateInput, AgentUpdateInput>
      resource={{
        list: listAgents,
        get: getAgent,
        create: createAgent,
        save: saveAgent,
        delete: deleteAgent,
      }}
      getKey={(a) => a.agentID}
      newDraft={newAgentDraft}
      toDraft={toDraft}
      draftToUpdate={draftToUpdate}
      draftToCreate={draftToCreate}
      validateCreate={(d) =>
        !d.agentID.trim() || !d.name.trim()
          ? "agentID and name are required"
          : null
      }
      labels={{
        singular: "agent",
        plural: "Agents",
        newTitle: "New agent",
      }}
      renderRow={(agent) => (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {agent.name}
            </span>
            <span
              className={clsx(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                agent.enabled
                  ? "bg-green-500/20 text-green-400"
                  : "bg-foreground-muted/20 text-foreground-muted",
              )}
            >
              {agent.enabled ? "enabled" : "disabled"}
            </span>
            <span className="text-xs text-foreground-muted/70">
              {agent.agentID}
            </span>
          </div>
          {agent.description && (
            <div className="text-xs text-foreground-muted mt-0.5 truncate">
              {agent.description}
            </div>
          )}
          {agent.modelOptions?.preferredModel && (
            <div className="text-xs text-foreground-muted/60 mt-0.5">
              model: {agent.modelOptions.preferredProvider ?? "?"}/
              {agent.modelOptions.preferredModel}
            </div>
          )}
        </>
      )}
      renderEditor={(props) => <AgentEditor {...props} />}
    />
  );
}

function AgentEditor({
  draft,
  setDraft,
  isCreating,
}: ManagePanelEditorProps<AgentConfig, Draft>) {
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...draft, [key]: value });

  const sandbox = draft.sandboxConfig ?? newSandbox();
  const updateSandbox = (patch: Partial<SandboxConfig>) =>
    update("sandboxConfig", { ...sandbox, ...patch });

  return (
    <>
      {isCreating && (
        <Field label="Agent ID (immutable)">
          <input
            type="text"
            value={draft.agentID}
            onChange={(e) => update("agentID", e.target.value)}
            className={inputClass}
            placeholder="e.g., research-agent"
          />
        </Field>
      )}

      <Field label="Name">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => update("name", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={draft.description}
          onChange={(e) => update("description", e.target.value)}
          rows={2}
          className={clsx(inputClass, "resize-none")}
        />
      </Field>

      <Field label="Prompt slug">
        <input
          type="text"
          value={draft.promptSlug ?? ""}
          onChange={(e) => update("promptSlug", e.target.value)}
          placeholder="(default)"
          className={inputClass}
        />
      </Field>

      <Toggle
        label="Enabled"
        value={draft.enabled}
        onChange={(v) => update("enabled", v)}
      />

      <Section title="Model Options">
        <Field label="Preferred provider">
          <input
            type="text"
            value={draft.modelOptions?.preferredProvider ?? ""}
            onChange={(e) =>
              update("modelOptions", {
                ...draft.modelOptions,
                preferredProvider: e.target.value,
              })
            }
            className={inputClass}
            placeholder="anthropic / openai / google / vllm"
          />
        </Field>
        <Field label="Preferred model">
          <input
            type="text"
            value={draft.modelOptions?.preferredModel ?? ""}
            onChange={(e) =>
              update("modelOptions", {
                ...draft.modelOptions,
                preferredModel: e.target.value,
              })
            }
            className={inputClass}
            placeholder="claude-sonnet-4-6"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max output tokens">
            <input
              type="number"
              value={draft.modelOptions?.maxOutputTokens ?? ""}
              onChange={(e) =>
                update("modelOptions", {
                  ...draft.modelOptions,
                  maxOutputTokens: e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined,
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Temperature">
            <input
              type="number"
              step="0.05"
              value={draft.modelOptions?.temperature ?? ""}
              onChange={(e) =>
                update("modelOptions", {
                  ...draft.modelOptions,
                  temperature: e.target.value
                    ? parseFloat(e.target.value)
                    : undefined,
                })
              }
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="Tool Policy">
        <Field label="Mode">
          <select
            value={draft.toolPolicy.mode}
            onChange={(e) =>
              update("toolPolicy", {
                ...draft.toolPolicy,
                mode: e.target.value as "allow" | "deny",
              })
            }
            className={inputClass}
          >
            <option value="deny">deny</option>
            <option value="allow">allow</option>
          </select>
        </Field>
        <Field
          label={`Tools (${draft.toolPolicy.mode === "allow" ? "allowed" : "denied"}, comma-separated)`}
        >
          <input
            type="text"
            value={draft.toolPolicy.tools.join(", ")}
            onChange={(e) =>
              update("toolPolicy", {
                ...draft.toolPolicy,
                tools: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Messaging Policy">
        <Toggle
          label="Messaging enabled"
          value={draft.messagingPolicy.enabled}
          onChange={(v) =>
            update("messagingPolicy", { ...draft.messagingPolicy, enabled: v })
          }
        />
        <Field label="Allowed agents (comma-separated)">
          <input
            type="text"
            value={draft.messagingPolicy.allowedAgents.join(", ")}
            onChange={(e) =>
              update("messagingPolicy", {
                ...draft.messagingPolicy,
                allowedAgents: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="Sandbox">
        <Toggle
          label="Sandbox enabled"
          value={sandbox.enabled}
          onChange={(v) => updateSandbox({ enabled: v })}
        />
        <Field label="Image">
          <input
            type="text"
            value={sandbox.image}
            onChange={(e) => updateSandbox({ image: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Memory (MB)">
            <input
              type="number"
              value={sandbox.memoryMb}
              onChange={(e) =>
                updateSandbox({ memoryMb: parseInt(e.target.value, 10) || 512 })
              }
              className={inputClass}
            />
          </Field>
          <Field label="CPU shares">
            <input
              type="number"
              value={sandbox.cpuShares}
              onChange={(e) =>
                updateSandbox({
                  cpuShares: parseInt(e.target.value, 10) || 1024,
                })
              }
              className={inputClass}
            />
          </Field>
        </div>
        <Toggle
          label="Network enabled"
          value={sandbox.networkEnabled}
          onChange={(v) => updateSandbox({ networkEnabled: v })}
        />
      </Section>
    </>
  );
}
