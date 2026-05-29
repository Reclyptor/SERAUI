"use server";

import { seraFetch } from "./_client";
import type { ModelOption } from "@/app/lib/models";

// Fetches the enabled model catalog from SERA. Server-side only (uses the
// session cookie via seraFetch). Callers should pass the result down to
// `<ModelCatalogProvider>` so client components read it synchronously.
export async function listModels(): Promise<ModelOption[]> {
  return seraFetch<ModelOption[]>("/models", {
    query: { enabled: "true" },
    errorContext: "load model catalog",
  });
}
