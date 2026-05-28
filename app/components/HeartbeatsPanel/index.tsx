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
  listHeartbeats,
  getHeartbeat,
  saveHeartbeat,
  createHeartbeat,
  deleteHeartbeat,
  type HeartbeatConfig,
  type HeartbeatCreateInput,
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

function defaultActiveHours(): ActiveHours {
  return { start: 9, end: 17, timezone: "UTC" };
}

function newHeartbeatDraft(): Draft {
  return {
    agentID: "",
    enabled: false,
    intervalMinutes: 30,
    hasActiveHours: false,
    activeHours: defaultActiveHours(),
    checklist: [],
    maxTokens: 2048,
  };
}

function toDraft(hb: HeartbeatConfig): Draft {
  return {
    agentID: hb.agentID,
    enabled: hb.enabled,
    intervalMinutes: hb.intervalMinutes,
    hasActiveHours: Boolean(hb.activeHours),
    activeHours: hb.activeHours ?? defaultActiveHours(),
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

function draftToCreate(d: Draft): HeartbeatCreateInput {
  return {
    agentID: d.agentID,
    enabled: d.enabled,
    intervalMinutes: d.intervalMinutes,
    activeHours: d.hasActiveHours ? d.activeHours : undefined,
    checklist: d.checklist,
    maxTokens: d.maxTokens,
  };
}

export function HeartbeatsPanel() {
  return (
    <ManagePanel<
      HeartbeatConfig,
      Draft,
      HeartbeatCreateInput,
      HeartbeatUpdateInput
    >
      resource={{
        list: listHeartbeats,
        get: getHeartbeat,
        create: createHeartbeat,
        save: saveHeartbeat,
        delete: deleteHeartbeat,
      }}
      getKey={(h) => h.agentID}
      newDraft={newHeartbeatDraft}
      toDraft={toDraft}
      draftToUpdate={draftToUpdate}
      draftToCreate={draftToCreate}
      validateCreate={(d) =>
        !d.agentID.trim() ? "agentID is required" : null
      }
      labels={{
        singular: "heartbeat",
        plural: "Heartbeats",
        newTitle: "New heartbeat",
        deleteConfirm: (key) => `Delete heartbeat for "${key}"?`,
      }}
      renderRow={(hb) => (
        <>
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
        </>
      )}
      renderEditor={(props) => <HeartbeatEditor {...props} />}
    />
  );
}

function HeartbeatEditor({
  draft,
  setDraft,
  isCreating,
}: ManagePanelEditorProps<HeartbeatConfig, Draft>) {
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...draft, [key]: value });

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
    </>
  );
}
