"use client";

import clsx from "clsx";
import {
  ManagePanel,
  type ManagePanelEditorProps,
} from "../ManagePanel";
import {
  listPrompts,
  getPrompt,
  savePrompt,
  type PromptDetail,
  type PromptListItem,
} from "@/app/actions/prompts";

interface Draft {
  content: string;
  extends?: string;
  description?: string;
  metadata: Record<string, unknown>;
}

function toDraft(p: PromptDetail): Draft {
  return {
    content: p.content,
    extends: p.extends,
    description: p.description,
    metadata: p.metadata,
  };
}

function draftToUpdate(d: Draft) {
  return {
    content: d.content,
    extends: d.extends,
    description: d.description,
    metadata: d.metadata,
  };
}

// PromptsPanel only supports list/get/save — no create or delete in the UI.
export function PromptsPanel() {
  return (
    <ManagePanel<PromptDetail, Draft, never, ReturnType<typeof draftToUpdate>>
      resource={{
        list: listPrompts as () => Promise<PromptDetail[]>,
        get: getPrompt,
        save: savePrompt,
      }}
      getKey={(p) => p.slug}
      newDraft={() => ({ content: "", metadata: {} })}
      toDraft={toDraft}
      draftToUpdate={draftToUpdate}
      draftToCreate={() => {
        throw new Error("PromptsPanel does not support create");
      }}
      labels={{
        singular: "prompt",
        plural: "Prompts",
        newTitle: "New prompt",
      }}
      renderRow={(prompt: PromptDetail | PromptListItem) => (
        <>
          <div className="text-sm font-medium text-foreground">
            {prompt.slug}
          </div>
          {prompt.description && (
            <div className="text-xs text-foreground-muted mt-0.5 truncate">
              {prompt.description}
            </div>
          )}
          {prompt.extends && (
            <div className="text-xs text-foreground-muted mt-0.5">
              extends {prompt.extends}
            </div>
          )}
        </>
      )}
      renderEditor={(props) => <PromptEditor {...props} />}
    />
  );
}

function PromptEditor({
  draft,
  setDraft,
}: ManagePanelEditorProps<PromptDetail, Draft>) {
  return (
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
  );
}
