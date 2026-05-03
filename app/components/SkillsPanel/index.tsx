"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { ArrowLeft, RotateCcw, Save, Loader2 } from "lucide-react";
import {
  listSkills,
  getSkill,
  saveSkill,
  type SkillListItem,
  type SkillDetail,
} from "@/app/actions/skills";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  stale: "bg-yellow-500/20 text-yellow-400",
  archived: "bg-foreground-muted/20 text-foreground-muted",
};

export function SkillsPanel() {
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [selected, setSelected] = useState<SkillDetail | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await listSkills();
      setSkills(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleSelect = async (name: string) => {
    try {
      setError(null);
      const detail = await getSkill(name);
      setSelected(detail);
      setDraftContent(detail.content);
      setDraftDescription(detail.description);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skill");
    }
  };

  const handleReset = () => {
    if (selected) {
      setDraftContent(selected.content);
      setDraftDescription(selected.description);
    }
  };

  const handleSave = async () => {
    if (!selected) return;

    try {
      setSaving(true);
      setError(null);
      const updated = await saveSkill(selected.name, {
        content: draftContent,
        description: draftDescription,
      });
      setSelected(updated);
      setDraftContent(updated.content);
      setDraftDescription(updated.description);
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setSelected(null);
    setDraftContent("");
    setDraftDescription("");
    setError(null);
  };

  const isDirty =
    selected !== null &&
    (draftContent !== selected.content ||
      draftDescription !== selected.description);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center h-14 px-6 shrink-0 border-b border-border">
        <div className="flex items-center gap-2">
          {selected && (
            <button
              onClick={handleBack}
              className="w-7 h-7 flex items-center justify-center rounded-md text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-foreground">
            {selected ? selected.name : "Skills"}
          </h2>
          {selected && (
            <span
              className={clsx(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                STATUS_COLORS[selected.status] ?? STATUS_COLORS.active,
              )}
            >
              {selected.status}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {selected ? (
        <SkillEditor
          selected={selected}
          draftContent={draftContent}
          setDraftContent={setDraftContent}
          draftDescription={draftDescription}
          setDraftDescription={setDraftDescription}
          isDirty={isDirty}
          saving={saving}
          onReset={handleReset}
          onSave={handleSave}
        />
      ) : (
        <SkillList
          skills={skills}
          loading={loading}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}

function SkillList({
  skills,
  loading,
  onSelect,
}: {
  skills: SkillListItem[];
  loading: boolean;
  onSelect: (name: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">
        No skills found
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {skills.map((skill) => (
        <button
          key={skill.name}
          onClick={() => onSelect(skill.name)}
          className="w-full text-left px-6 py-3 border-b border-border hover:bg-background-tertiary transition-colors"
        >
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
        </button>
      ))}
    </div>
  );
}

function SkillEditor({
  selected,
  draftContent,
  setDraftContent,
  draftDescription,
  setDraftDescription,
  isDirty,
  saving,
  onReset,
  onSave,
}: {
  selected: SkillDetail;
  draftContent: string;
  setDraftContent: (v: string) => void;
  draftDescription: string;
  setDraftDescription: (v: string) => void;
  isDirty: boolean;
  saving: boolean;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div className="flex-1 overflow-hidden p-6 flex flex-col gap-3">
        <div>
          <label className="text-xs text-foreground-muted mb-1 block">
            Description
          </label>
          <input
            type="text"
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            className={clsx(
              "w-full rounded-lg px-3 py-2",
              "bg-background-secondary border border-border",
              "text-sm text-foreground",
              "focus:outline-none focus:ring-1 focus:ring-foreground-muted",
            )}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <label className="text-xs text-foreground-muted mb-1 block">
            Content
          </label>
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            className={clsx(
              "w-full flex-1 resize-none rounded-lg p-3",
              "bg-background-secondary border border-border",
              "text-sm text-foreground font-mono leading-relaxed",
              "focus:outline-none focus:ring-1 focus:ring-foreground-muted",
            )}
            spellCheck={false}
          />
        </div>

        {selected.files.length > 0 && (
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
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border shrink-0">
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
    </>
  );
}
