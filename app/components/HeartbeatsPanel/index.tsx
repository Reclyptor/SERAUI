"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { ArrowLeft, RotateCcw, Save, Loader2, Plus, Trash2 } from "lucide-react";
import {
  listHeartbeats,
  getHeartbeat,
  saveHeartbeat,
  createHeartbeat,
  deleteHeartbeat,
  type HeartbeatConfig,
  type HeartbeatUpdateInput,
  type ActiveHours,
} from "@/app/actions/heartbeats";

interface Draft {
  agentID: string;
  enabled: boolean;
  intervalMinutes: number;
  hasActiveHours: boolean;
  activeHours: ActiveHours;
  checklist: string[];
  maxTokens: number;
}

const NEW_DRAFT: Draft = {
  agentID: "",
  enabled: false,
  intervalMinutes: 30,
  hasActiveHours: false,
  activeHours: { start: 9, end: 17, timezone: "UTC" },
  checklist: [],
  maxTokens: 2048,
};

function toDraft(hb: HeartbeatConfig): Draft {
  return {
    agentID: hb.agentID,
    enabled: hb.enabled,
    intervalMinutes: hb.intervalMinutes,
    hasActiveHours: Boolean(hb.activeHours),
    activeHours: hb.activeHours ?? NEW_DRAFT.activeHours,
    checklist: [...hb.checklist],
    maxTokens: hb.maxTokens,
  };
}

function draftToUpdate(d: Draft): HeartbeatUpdateInput {
  return {
    enabled: d.enabled,
    intervalMinutes: d.intervalMinutes,
    activeHours: d.hasActiveHours ? d.activeHours : undefined,
    checklist: d.checklist,
    maxTokens: d.maxTokens,
  };
}

export function HeartbeatsPanel() {
  const [items, setItems] = useState<HeartbeatConfig[]>([]);
  const [selected, setSelected] = useState<HeartbeatConfig | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await listHeartbeats());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load heartbeats");
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
      const hb = await getHeartbeat(agentID);
      setSelected(hb);
      setDraft(toDraft(hb));
      setIsCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load heartbeat");
    }
  };

  const handleNew = () => {
    setSelected(null);
    setDraft({ ...NEW_DRAFT });
    setIsCreating(true);
    setError(null);
  };

  const handleReset = () => {
    if (selected) setDraft(toDraft(selected));
    else if (isCreating) setDraft({ ...NEW_DRAFT });
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      setError(null);
      if (isCreating) {
        if (!draft.agentID.trim()) throw new Error("agentID is required");
        const created = await createHeartbeat({
          agentID: draft.agentID,
          enabled: draft.enabled,
          intervalMinutes: draft.intervalMinutes,
          activeHours: draft.hasActiveHours ? draft.activeHours : undefined,
          checklist: draft.checklist,
          maxTokens: draft.maxTokens,
        });
        setSelected(created);
        setDraft(toDraft(created));
        setIsCreating(false);
      } else if (selected) {
        const updated = await saveHeartbeat(
          selected.agentID,
          draftToUpdate(draft),
        );
        setSelected(updated);
        setDraft(toDraft(updated));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save heartbeat");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Delete heartbeat for "${selected.agentID}"?`)) return;
    try {
      setSaving(true);
      setError(null);
      await deleteHeartbeat(selected.agentID);
      setSelected(null);
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
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
                ? "New heartbeat"
                : (selected?.agentID ?? "")
              : "Heartbeats"}
          </h2>
          {!inEditor && !loading && (
            <span className="ml-1 text-xs text-foreground-muted">
              {items.length}
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
        <HeartbeatEditor
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
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">
          No heartbeats found
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {items.map((hb) => (
            <button
              key={hb.agentID}
              onClick={() => handleSelect(hb.agentID)}
              className="w-full text-left px-6 py-3 border-b border-border hover:bg-background-tertiary transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {hb.agentID}
                </span>
                <span
                  className={clsx(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    hb.enabled
                      ? "bg-green-500/20 text-green-400"
                      : "bg-foreground-muted/20 text-foreground-muted",
                  )}
                >
                  {hb.enabled ? "enabled" : "disabled"}
                </span>
              </div>
              <div className="text-xs text-foreground-muted mt-0.5">
                every {hb.intervalMinutes}m · {hb.checklist.length} checklist
                item{hb.checklist.length === 1 ? "" : "s"}
                {hb.nextRunAt && (
                  <> · next {new Date(hb.nextRunAt).toLocaleString()}</>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HeartbeatEditor({
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

        <Toggle
          label="Enabled"
          value={draft.enabled}
          onChange={(v) => update("enabled", v)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Interval (minutes)">
            <input
              type="number"
              min={1}
              value={draft.intervalMinutes}
              onChange={(e) =>
                update("intervalMinutes", parseInt(e.target.value, 10) || 1)
              }
              className={inputClass}
            />
          </Field>
          <Field label="Max tokens">
            <input
              type="number"
              min={1}
              value={draft.maxTokens}
              onChange={(e) =>
                update("maxTokens", parseInt(e.target.value, 10) || 2048)
              }
              className={inputClass}
            />
          </Field>
        </div>

        <Section title="Active Hours">
          <Toggle
            label="Restrict to active hours"
            value={draft.hasActiveHours}
            onChange={(v) => update("hasActiveHours", v)}
          />
          {draft.hasActiveHours && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Start (0–23)">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={draft.activeHours.start}
                  onChange={(e) =>
                    update("activeHours", {
                      ...draft.activeHours,
                      start: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="End (0–23)">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={draft.activeHours.end}
                  onChange={(e) =>
                    update("activeHours", {
                      ...draft.activeHours,
                      end: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Timezone">
                <input
                  type="text"
                  value={draft.activeHours.timezone ?? "UTC"}
                  onChange={(e) =>
                    update("activeHours", {
                      ...draft.activeHours,
                      timezone: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </Section>

        <Section title="Checklist">
          <div className="text-xs text-foreground-muted">
            One item per line. Appended to the heartbeat prompt.
          </div>
          <textarea
            value={draft.checklist.join("\n")}
            onChange={(e) =>
              update(
                "checklist",
                e.target.value
                  .split("\n")
                  .map((s) => s.trimEnd())
                  .filter(Boolean),
              )
            }
            rows={6}
            className={clsx(inputClass, "resize-none font-mono")}
            spellCheck={false}
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
