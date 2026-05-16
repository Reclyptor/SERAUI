"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { ArrowLeft, RotateCcw, Save, Loader2, Plus, Trash2 } from "lucide-react";
import {
  listAgents,
  getAgent,
  saveAgent,
  createAgent,
  deleteAgent,
  type AgentConfig,
  type AgentUpdateInput,
} from "@/app/actions/agents";

type Draft = Omit<AgentConfig, "createdAt" | "updatedAt">;

const NEW_AGENT_DRAFT: Draft = {
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
  sandboxConfig: {
    enabled: false,
    image: "node:20-slim",
    memoryMb: 512,
    cpuShares: 1024,
    networkEnabled: false,
    envVars: {},
  },
};

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

export function AgentsPanel() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selected, setSelected] = useState<AgentConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAgents(await listAgents());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelect = async (agentID: string) => {
    try {
      setError(null);
      const agent = await getAgent(agentID);
      setSelected(agent);
      setDraft(toDraft(agent));
      setIsCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent");
    }
  };

  const handleNew = () => {
    setSelected(null);
    setDraft({ ...NEW_AGENT_DRAFT });
    setIsCreating(true);
    setError(null);
  };

  const handleReset = () => {
    if (selected) {
      setDraft(toDraft(selected));
    } else if (isCreating) {
      setDraft({ ...NEW_AGENT_DRAFT });
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      setError(null);
      if (isCreating) {
        if (!draft.agentID.trim() || !draft.name.trim()) {
          throw new Error("agentID and name are required");
        }
        const created = await createAgent({
          agentID: draft.agentID,
          name: draft.name,
          description: draft.description,
          promptSlug: draft.promptSlug || undefined,
          modelOptions: draftToUpdate(draft).modelOptions,
          toolPolicy: draft.toolPolicy,
          messagingPolicy: draft.messagingPolicy,
          sandboxConfig: draft.sandboxConfig,
          enabled: draft.enabled,
        });
        setSelected(created);
        setDraft(toDraft(created));
        setIsCreating(false);
      } else if (selected) {
        const updated = await saveAgent(selected.agentID, draftToUpdate(draft));
        setSelected(updated);
        setDraft(toDraft(updated));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Delete agent "${selected.agentID}"?`)) return;
    try {
      setSaving(true);
      setError(null);
      await deleteAgent(selected.agentID);
      setSelected(null);
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setSelected(null);
    setDraft(null);
    setIsCreating(false);
    setError(null);
  };

  const isDirty =
    draft !== null &&
    (isCreating ||
      (selected !== null &&
        JSON.stringify(draftToUpdate(draft)) !==
          JSON.stringify(draftToUpdate(toDraft(selected)))));

  const inEditor = draft !== null;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between h-14 px-6 shrink-0 border-b border-border">
        <div className="flex items-center gap-2">
          {inEditor && (
            <button
              onClick={handleBack}
              className="w-7 h-7 flex items-center justify-center rounded-md text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-foreground">
            {inEditor
              ? isCreating
                ? "New agent"
                : (selected?.agentID ?? "")
              : "Agents"}
          </h2>
          {!inEditor && !loading && (
            <span className="ml-1 text-xs text-foreground-muted">
              {agents.length}
            </span>
          )}
        </div>
        {!inEditor && (
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        )}
      </div>

      {error && (
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {inEditor && draft ? (
        <AgentEditor
          draft={draft}
          setDraft={setDraft}
          isCreating={isCreating}
          isDirty={isDirty}
          saving={saving}
          onReset={handleReset}
          onSave={handleSave}
          onDelete={selected ? handleDelete : undefined}
        />
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
        </div>
      ) : agents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">
          No agents found
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {agents.map((agent) => (
            <button
              key={agent.agentID}
              onClick={() => handleSelect(agent.agentID)}
              className="w-full text-left px-6 py-3 border-b border-border hover:bg-background-tertiary transition-colors"
            >
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentEditor({
  draft,
  setDraft,
  isCreating,
  isDirty,
  saving,
  onReset,
  onSave,
  onDelete,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  isCreating: boolean;
  isDirty: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...draft, [key]: value });

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
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
            value={draft.sandboxConfig?.enabled ?? false}
            onChange={(v) =>
              update("sandboxConfig", {
                ...(draft.sandboxConfig ?? NEW_AGENT_DRAFT.sandboxConfig!),
                enabled: v,
              })
            }
          />
          <Field label="Image">
            <input
              type="text"
              value={draft.sandboxConfig?.image ?? ""}
              onChange={(e) =>
                update("sandboxConfig", {
                  ...(draft.sandboxConfig ?? NEW_AGENT_DRAFT.sandboxConfig!),
                  image: e.target.value,
                })
              }
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Memory (MB)">
              <input
                type="number"
                value={draft.sandboxConfig?.memoryMb ?? 512}
                onChange={(e) =>
                  update("sandboxConfig", {
                    ...(draft.sandboxConfig ?? NEW_AGENT_DRAFT.sandboxConfig!),
                    memoryMb: parseInt(e.target.value, 10) || 512,
                  })
                }
                className={inputClass}
              />
            </Field>
            <Field label="CPU shares">
              <input
                type="number"
                value={draft.sandboxConfig?.cpuShares ?? 1024}
                onChange={(e) =>
                  update("sandboxConfig", {
                    ...(draft.sandboxConfig ?? NEW_AGENT_DRAFT.sandboxConfig!),
                    cpuShares: parseInt(e.target.value, 10) || 1024,
                  })
                }
                className={inputClass}
              />
            </Field>
          </div>
          <Toggle
            label="Network enabled"
            value={draft.sandboxConfig?.networkEnabled ?? false}
            onChange={(v) =>
              update("sandboxConfig", {
                ...(draft.sandboxConfig ?? NEW_AGENT_DRAFT.sandboxConfig!),
                networkEnabled: v,
              })
            }
          />
        </Section>
      </div>

      <EditorActions
        isDirty={isDirty}
        saving={saving}
        onReset={onReset}
        onSave={onSave}
        onDelete={onDelete}
      />
    </>
  );
}

const inputClass =
  "w-full rounded-lg px-3 py-2 bg-background-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground-muted";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-foreground-muted mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border pt-3 flex flex-col gap-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-border bg-background-secondary"
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

function EditorActions({
  isDirty,
  saving,
  onReset,
  onSave,
  onDelete,
}: {
  isDirty: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-border shrink-0">
      {onDelete ? (
        <button
          onClick={onDelete}
          disabled={saving}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
            "text-red-400 hover:text-red-300 hover:bg-red-500/10",
            saving && "opacity-50 cursor-not-allowed",
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          disabled={!isDirty}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
            isDirty
              ? "text-foreground-muted hover:text-foreground hover:bg-background-tertiary"
              : "text-foreground-muted/40 cursor-not-allowed",
          )}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty || saving}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            isDirty && !saving
              ? "bg-foreground text-background hover:opacity-90"
              : "bg-foreground/20 text-foreground/40 cursor-not-allowed",
          )}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}
