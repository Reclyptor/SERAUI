"use client";

import clsx from "clsx";
import {
  ManagePanel,
  Field,
  inputClass,
  type ManagePanelEditorProps,
} from "../ManagePanel";
import {
  listSkills,
  getSkill,
  saveSkill,
  type SkillDetail,
  type SkillListItem,
} from "@/app/actions/skills";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  stale: "bg-yellow-500/20 text-yellow-400",
  archived: "bg-foreground-muted/20 text-foreground-muted",
};

interface Draft {
  content: string;
  description: string;
  allowedTools: string[];
  metadata: Record<string, unknown>;
}

function toDraft(s: SkillDetail): Draft {
  return {
    content: s.content,
    description: s.description,
    allowedTools: s.allowedTools,
    metadata: s.metadata,
  };
}

function draftToUpdate(d: Draft) {
  return {
    content: d.content,
    description: d.description,
    allowedTools: d.allowedTools,
    metadata: d.metadata,
  };
}

export function SkillsPanel() {
  return (
    <ManagePanel<SkillDetail, Draft, never, ReturnType<typeof draftToUpdate>>
      resource={{
        list: listSkills as () => Promise<SkillDetail[]>,
        get: getSkill,
        save: saveSkill,
      }}
      getKey={(s) => s.name}
      newDraft={() => ({
        content: "",
        description: "",
        allowedTools: [],
        metadata: {},
      })}
      toDraft={toDraft}
      draftToUpdate={draftToUpdate}
      draftToCreate={() => {
        throw new Error("SkillsPanel does not support create");
      }}
      labels={{
        singular: "skill",
        plural: "Skills",
        newTitle: "New skill",
      }}
      editorTitle={(s) => s.name}
      renderRow={(skill: SkillDetail | SkillListItem) => (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {skill.name}
            </span>
            <span
              className={clsx(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                STATUS_COLORS[skill.status] ?? STATUS_COLORS.active,
              )}
            >
              {skill.status}
            </span>
          </div>
          {skill.description && (
            <div className="text-xs text-foreground-muted mt-0.5 truncate">
              {skill.description}
            </div>
          )}
          {skill.allowedTools.length > 0 && (
            <div className="text-xs text-foreground-muted/60 mt-0.5">
              tools: {skill.allowedTools.join(", ")}
            </div>
          )}
        </>
      )}
      renderEditor={(props) => <SkillEditor {...props} />}
    />
  );
}

function SkillEditor({
  draft,
  setDraft,
  selected,
}: ManagePanelEditorProps<SkillDetail, Draft>) {
  return (
    <>
      <Field label="Description">
        <input
          type="text"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className={inputClass}
        />
      </Field>

      <div className="flex-1 flex flex-col min-h-0">
        <label className="text-xs text-foreground-muted mb-1 block">
          Content
        </label>
        <textarea
          value={draft.content}
          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          className={clsx(
            "w-full flex-1 resize-none rounded-lg p-3",
            "bg-background-secondary border border-border",
            "text-sm text-foreground font-mono leading-relaxed",
            "focus:outline-none focus:ring-1 focus:ring-foreground-muted",
          )}
          spellCheck={false}
        />
      </div>

      {selected && selected.files.length > 0 && (
        <div>
          <label className="text-xs text-foreground-muted mb-1 block">
            Files ({selected.files.length})
          </label>
          <div className="flex flex-wrap gap-1.5">
            {selected.files.map((f) => (
              <span
                key={f.path}
                className="text-xs px-2 py-1 rounded bg-background-secondary border border-border text-foreground-muted"
              >
                {f.path}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
