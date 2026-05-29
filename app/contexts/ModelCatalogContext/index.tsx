"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ModelOption } from "@/app/lib/models";

interface ModelCatalogContextValue {
  models: readonly ModelOption[];
}

const ModelCatalogContext = createContext<ModelCatalogContextValue | null>(
  null,
);

interface ModelCatalogProviderProps {
  initialCatalog: readonly ModelOption[];
  children: ReactNode;
}

export function ModelCatalogProvider({
  initialCatalog,
  children,
}: ModelCatalogProviderProps) {
  const value = useMemo(() => ({ models: initialCatalog }), [initialCatalog]);
  return (
    <ModelCatalogContext.Provider value={value}>
      {children}
    </ModelCatalogContext.Provider>
  );
}

export function useModelCatalog(): readonly ModelOption[] {
  const ctx = useContext(ModelCatalogContext);
  if (!ctx) {
    throw new Error(
      "useModelCatalog must be used within <ModelCatalogProvider>",
    );
  }
  return ctx.models;
}
