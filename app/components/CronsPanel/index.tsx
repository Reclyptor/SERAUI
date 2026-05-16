"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { ArrowLeft, RotateCcw, Save, Loader2, Plus, Trash2 } from "lucide-react";
import {
  listCrons,
  getCron,
  saveCron,
  createCron,
  deleteCron,
  type CronJob,
  type CronUpdateInput,
} from "@/app/actions/crons";

interface Draft {
  jobID: string;
  agentID: string;
  schedule: string;
  command: string;
  description: string;
  enabled: boolean;
  script: string;
  contextFromJobID: string;
}

const NEW_DRAFT: Draft = {
  jobID: "",
  agentID: "",
  schedule: "*/30 * * * *",
  command: "",
  description: "",
  enabled: true,
  script: "",
  contextFromJobID: "",
};

function toDraft(job: CronJob): Draft {
  return {
    jobID: job.jobID,
    agentID: job.agentID,
    schedule: job.schedule,
    command: job.command,
    description: job.description,
    enabled: job.enabled,
    script: job.script,
    contextFromJobID: job.contextFromJobID,
  };
}

function draftToUpdate(d: Draft): CronUpdateInput {
  return {
    schedule: d.schedule,
    command: d.command,
    description: d.description,
    enabled: d.enabled,
    script: d.script,
    contextFromJobID: d.contextFromJobID,
  };
}

export function CronsPanel() {
  const [items, setItems] = useState<CronJob[]>([]);
  const [selected, setSelected] = useState<CronJob | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await listCrons());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cron jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelect = async (jobID: string) => {
    try {
      setError(null);
      const job = await getCron(jobID);
      setSelected(job);
      setDraft(toDraft(job));
      setIsCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cron job");
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
        if (!draft.agentID.trim() || !draft.schedule.trim() || !draft.command.trim()) {
          throw new Error("agentID, schedule, and command are required");
        }
        const created = await createCron({
          agentID: draft.agentID,
          schedule: draft.schedule,
          command: draft.command,
          description: draft.description,
          enabled: draft.enabled,
          script: draft.script,
          contextFromJobID: draft.contextFromJobID,
        });
        setSelected(created);
        setDraft(toDraft(created));
        setIsCreating(false);
      } else if (selected) {
        const updated = await saveCron(selected.jobID, draftToUpdate(draft));
        setSelected(updated);
        setDraft(toDraft(updated));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cron job");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Delete cron job "${selected.jobID}"?`)) return;
    try {
      setSaving(true);
      setError(null);
      await deleteCron(selected.jobID);
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
                ? "New cron job"
                : (selected?.description || selected?.jobID || "")
              : "Cron Jobs"}
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
        <CronEditor
          draft={draft}
          setDraft={setDraft}
          selected={selected}
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
          No cron jobs found
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {items.map((job) => (
            <button
              key={job.jobID}
              onClick={() => handleSelect(job.jobID)}
              className="w-full text-left px-6 py-3 border-b border-border hover:bg-background-tertiary transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {job.description || job.jobID}
                </span>
                <span
                  className={clsx(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    job.enabled
                      ? "bg-green-500/20 text-green-400"
                      : "bg-foreground-muted/20 text-foreground-muted",
                  )}
                >
                  {job.enabled ? "enabled" : "disabled"}
                </span>
              </div>
              <div className="text-xs text-foreground-muted mt-0.5 font-mono">
                {job.schedule} · {job.agentID}
              </div>
              {job.nextRunAt && (
                <div className="text-xs text-foreground-muted/60 mt-0.5">
                  next: {new Date(job.nextRunAt).toLocaleString()}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CronEditor({
  draft,
  setDraft,
  selected,
  isCreating,
  isDirty,
  saving,
  onReset,
  onSave,
  onDelete,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  selected: CronJob | null;
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
        {isCreating ? (
          <Field label="Agent ID">
            <input
              type="text"
              value={draft.agentID}
              onChange={(e) => update("agentID", e.target.value)}
              className={inputClass}
              placeholder="e.g., research-agent"
            />
          </Field>
        ) : (
          <Field label="Agent ID (immutable)">
            <input
              type="text"
              value={draft.agentID}
              disabled
              className={clsx(inputClass, "opacity-60 cursor-not-allowed")}
            />
          </Field>
        )}

        <Field label="Description">
          <input
            type="text"
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            className={inputClass}
            placeholder="Short label for the list view"
          />
        </Field>

        <Toggle
          label="Enabled"
          value={draft.enabled}
          onChange={(v) => update("enabled", v)}
        />

        <Field label="Schedule (cron expression)">
          <input
            type="text"
            value={draft.schedule}
            onChange={(e) => update("schedule", e.target.value)}
            className={clsx(inputClass, "font-mono")}
            placeholder="*/30 * * * *"
            spellCheck={false}
          />
        </Field>

        <Field label="Command (prompt sent to the agent)">
          <textarea
            value={draft.command}
            onChange={(e) => update("command", e.target.value)}
            rows={4}
            className={clsx(inputClass, "resize-none")}
            spellCheck={false}
          />
        </Field>

        <Field label="Script (optional shell — output appended to prompt)">
          <textarea
            value={draft.script}
            onChange={(e) => update("script", e.target.value)}
            rows={3}
            className={clsx(inputClass, "resize-none font-mono")}
            placeholder="(empty)"
            spellCheck={false}
          />
        </Field>

        <Field label="Context from job ID (optional)">
          <input
            type="text"
            value={draft.contextFromJobID}
            onChange={(e) => update("contextFromJobID", e.target.value)}
            className={inputClass}
            placeholder="Inherit last response from another job"
          />
        </Field>

        {selected && (
          <Section title="Run history">
            <div className="text-xs text-foreground-muted space-y-1">
              <div>
                Last run:{" "}
                {selected.lastRunAt
                  ? new Date(selected.lastRunAt).toLocaleString()
                  : "never"}
              </div>
              <div>
                Next run:{" "}
                {selected.nextRunAt
                  ? new Date(selected.nextRunAt).toLocaleString()
                  : "unscheduled"}
              </div>
              {selected.lastRunID && (
                <div className="font-mono text-foreground-muted/60">
                  last run id: {selected.lastRunID}
                </div>
              )}
            </div>
          </Section>
        )}
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
