"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import clsx from "clsx";
import {
  ArrowLeft,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

// Generic master/detail panel shell shared by Agents / Crons / Heartbeats /
// Prompts / Skills / Memories. The shell owns list/select/new/reset/save/
// delete state. Each resource provides:
//
//   - `resource`: the server-action handles (list / get / create / save /
//     delete; create and delete are optional).
//   - `getKey`: stable id of an item for list keys and the URL-ish slug
//     passed to get/save/delete.
//   - `newDraft`: factory returning a fresh draft. MUST be a function (not
//     a shared constant) so nested objects aren't aliased between editor
//     opens.
//   - `toDraft` / `draftToUpdate` / `draftToCreate`: shape conversions.
//   - `renderRow` / `renderEditor`: per-resource visuals.
//   - `validateCreate`: returns an error string if the create draft is
//     invalid; null otherwise.

export interface ManagePanelResource<TItem, TCreate, TUpdate> {
  list: () => Promise<TItem[]>;
  get: (key: string) => Promise<TItem>;
  create?: (input: TCreate) => Promise<TItem>;
  save: (key: string, input: TUpdate) => Promise<TItem>;
  delete?: (key: string) => Promise<void>;
}

export interface ManagePanelLabels {
  singular: string;
  plural: string;
  newTitle: string;
  emptyMessage?: string;
  deleteConfirm?: (key: string) => string;
}

export interface ManagePanelEditorProps<TItem, TDraft> {
  draft: TDraft;
  setDraft: (next: TDraft) => void;
  isCreating: boolean;
  selected: TItem | null;
}

interface ManagePanelProps<TItem, TDraft, TCreate, TUpdate> {
  resource: ManagePanelResource<TItem, TCreate, TUpdate>;
  getKey: (item: TItem) => string;
  newDraft: () => TDraft;
  toDraft: (item: TItem) => TDraft;
  draftToUpdate: (draft: TDraft) => TUpdate;
  draftToCreate: (draft: TDraft) => TCreate;
  validateCreate?: (draft: TDraft) => string | null;
  labels: ManagePanelLabels;
  renderRow: (item: TItem) => ReactNode;
  renderEditor: (props: ManagePanelEditorProps<TItem, TDraft>) => ReactNode;
  // Optional override for the title shown when the editor is open on an
  // existing item. Defaults to `getKey(selected)`.
  editorTitle?: (item: TItem) => string;
}

export function ManagePanel<TItem, TDraft, TCreate, TUpdate>({
  resource,
  getKey,
  newDraft,
  toDraft,
  draftToUpdate,
  draftToCreate,
  validateCreate,
  labels,
  renderRow,
  renderEditor,
  editorTitle,
}: ManagePanelProps<TItem, TDraft, TCreate, TUpdate>) {
  const [items, setItems] = useState<TItem[]>([]);
  const [selected, setSelected] = useState<TItem | null>(null);
  const [draft, setDraft] = useState<TDraft | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the most recent select request so a slow earlier response can't
  // overwrite the user's newer pick.
  const selectTokenRef = useRef(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await resource.list());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to load ${labels.plural.toLowerCase()}`,
      );
    } finally {
      setLoading(false);
    }
  }, [resource, labels.plural]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelect = async (key: string) => {
    const token = ++selectTokenRef.current;
    try {
      setError(null);
      const item = await resource.get(key);
      if (token !== selectTokenRef.current) return;
      setSelected(item);
      setDraft(toDraft(item));
      setIsCreating(false);
    } catch (err) {
      if (token !== selectTokenRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : `Failed to load ${labels.singular}`,
      );
    }
  };

  const handleNew = () => {
    if (!resource.create) return;
    selectTokenRef.current++;
    setSelected(null);
    setDraft(newDraft());
    setIsCreating(true);
    setError(null);
  };

  const handleReset = () => {
    if (selected) setDraft(toDraft(selected));
    else if (isCreating) setDraft(newDraft());
  };

  const handleSave = async () => {
    if (!draft) return;
    let saved: TItem | null = null;
    try {
      setSaving(true);
      setError(null);
      if (isCreating) {
        if (!resource.create) throw new Error("Create is not supported");
        const validationError = validateCreate?.(draft);
        if (validationError) throw new Error(validationError);
        saved = await resource.create(draftToCreate(draft));
        setIsCreating(false);
      } else if (selected) {
        saved = await resource.save(getKey(selected), draftToUpdate(draft));
      }
      if (saved) {
        setSelected(saved);
        setDraft(toDraft(saved));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to save ${labels.singular}`,
      );
      setSaving(false);
      return;
    } finally {
      // Saving is intentionally not cleared here on success — we still need
      // the list-refresh below to settle before re-enabling Save.
    }
    // List refresh runs OUTSIDE the save try/catch so a list-fetch error
    // doesn't surface as "Failed to save" when the save actually succeeded.
    try {
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Saved, but failed to refresh ${labels.plural.toLowerCase()}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || !resource.delete) return;
    const key = getKey(selected);
    const message =
      labels.deleteConfirm?.(key) ?? `Delete ${labels.singular} "${key}"?`;
    if (!confirm(message)) return;
    try {
      setSaving(true);
      setError(null);
      await resource.delete(key);
      setSelected(null);
      setDraft(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to delete ${labels.singular}`,
      );
      setSaving(false);
      return;
    }
    try {
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Deleted, but failed to refresh ${labels.plural.toLowerCase()}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    selectTokenRef.current++;
    setSelected(null);
    setDraft(null);
    setIsCreating(false);
    setError(null);
  };

  // Memoize the serialized baseline so dirty-checking doesn't re-derive
  // toDraft(selected) on every keystroke.
  const baseline = useMemo(
    () => (selected ? JSON.stringify(draftToUpdate(toDraft(selected))) : null),
    [selected, toDraft, draftToUpdate],
  );
  const isDirty =
    draft !== null &&
    (isCreating ||
      (baseline !== null &&
        JSON.stringify(draftToUpdate(draft)) !== baseline));

  const inEditor = draft !== null;
  const headerTitle = inEditor
    ? isCreating
      ? labels.newTitle
      : selected
        ? editorTitle?.(selected) ?? getKey(selected)
        : ""
    : labels.plural;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between h-14 px-6 shrink-0 border-b border-border">
        <div className="flex items-center gap-2">
          {inEditor && (
            <button
              type="button"
              onClick={handleBack}
              aria-label={`Back to ${labels.plural}`}
              className="w-7 h-7 flex items-center justify-center rounded-md text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-foreground">
            {headerTitle}
          </h2>
          {!inEditor && !loading && (
            <span className="ml-1 text-xs text-foreground-muted">
              {items.length}
            </span>
          )}
        </div>
        {!inEditor && resource.create && (
          <button
            type="button"
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
        <>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {renderEditor({ draft, setDraft, isCreating, selected })}
          </div>
          <EditorActions
            isDirty={isDirty}
            saving={saving}
            onReset={handleReset}
            onSave={handleSave}
            onDelete={
              selected && resource.delete ? handleDelete : undefined
            }
          />
        </>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">
          {labels.emptyMessage ?? `No ${labels.plural.toLowerCase()} found`}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {items.map((item) => (
            <button
              key={getKey(item)}
              type="button"
              onClick={() => handleSelect(getKey(item))}
              className="w-full text-left px-6 py-3 border-b border-border hover:bg-background-tertiary transition-colors"
            >
              {renderRow(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Shared editor helpers (exported so per-resource renderEditors can use them) ---

export const inputClass =
  "w-full rounded-lg px-3 py-2 bg-background-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground-muted";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-foreground-muted mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
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

export function Toggle({
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
          type="button"
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
          type="button"
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
          type="button"
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
