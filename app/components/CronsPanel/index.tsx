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
  listCrons,
  getCron,
  saveCron,
  createCron,
  deleteCron,
  type CronJob,
  type CronCreateInput,
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

function newCronDraft(): Draft {
  return {
    jobID: "",
    agentID: "",
    schedule: "*/30 * * * *",
    command: "",
    description: "",
    enabled: true,
    script: "",
    contextFromJobID: "",
  };
}

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

function draftToCreate(d: Draft): CronCreateInput {
  return {
    agentID: d.agentID,
    schedule: d.schedule,
    command: d.command,
    description: d.description,
    enabled: d.enabled,
    script: d.script,
    contextFromJobID: d.contextFromJobID,
  };
}

export function CronsPanel() {
  return (
    <ManagePanel<CronJob, Draft, CronCreateInput, CronUpdateInput>
      resource={{
        list: () => listCrons(),
        get: getCron,
        create: createCron,
        save: saveCron,
        delete: deleteCron,
      }}
      getKey={(j) => j.jobID}
      newDraft={newCronDraft}
      toDraft={toDraft}
      draftToUpdate={draftToUpdate}
      draftToCreate={draftToCreate}
      validateCreate={(d) =>
        !d.agentID.trim() || !d.schedule.trim() || !d.command.trim()
          ? "agentID, schedule, and command are required"
          : null
      }
      labels={{
        singular: "cron job",
        plural: "Cron Jobs",
        newTitle: "New cron job",
      }}
      editorTitle={(j) => j.description || j.jobID}
      renderRow={(job) => (
        <>
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
        </>
      )}
      renderEditor={(props) => <CronEditor {...props} />}
    />
  );
}

function CronEditor({
  draft,
  setDraft,
  isCreating,
  selected,
}: ManagePanelEditorProps<CronJob, Draft>) {
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...draft, [key]: value });

  return (
    <>
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
    </>
  );
}
