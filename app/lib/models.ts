// Mirrors the shape returned by SERA's GET /api/v1/models endpoint
// (see SERA `ModelCatalogEntry`). The catalog is the single source of truth:
// runtime data lives in Mongo, cached in Redis for 300s. SERAUI fetches it
// per-request via `listModels` (see app/actions/models.ts) and threads it
// through `<ModelCatalogProvider>` so client components can read it
// synchronously via `useModelCatalog`.
export interface ModelOption {
  spec: string;
  provider: string;
  modelID: string;
  displayName: string;
  enabled: boolean;
  contextWindow?: number;
}

export function getModelBySpec(
  models: readonly ModelOption[],
  spec: string,
): ModelOption | undefined {
  return models.find((m) => m.spec === spec);
}

// Returns null when the spec is not in the catalog. Callers must decide how
// to surface that — there is no synthesized display string from the raw spec.
export function getModelDisplayName(
  models: readonly ModelOption[],
  spec: string,
): string | null {
  const model = getModelBySpec(models, spec);
  if (!model) return null;
  return model.displayName;
}

// Groups by the raw `provider` field from the catalog. Group headers render
// the provider id verbatim — no client-side label mapping. If a friendlier
// name is desired, add a column on SERA's `ModelCatalogEntry` schema.
export function groupModelsByProvider(
  models: readonly ModelOption[],
): [string, ModelOption[]][] {
  const groups = new Map<string, ModelOption[]>();
  for (const model of models) {
    let bucket = groups.get(model.provider);
    if (!bucket) {
      bucket = [];
      groups.set(model.provider, bucket);
    }
    bucket.push(model);
  }
  return Array.from(groups.entries());
}
