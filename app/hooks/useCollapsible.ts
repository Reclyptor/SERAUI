"use client";

import { useCallback, useState } from "react";

// Auto-collapse with manual override:
//   - When `autoCollapsed` changes (e.g. a streaming block finishes and is
//     no longer the latest), the block auto-collapses.
//   - A click toggles to the opposite of whatever's currently shown and
//     locks that choice in until the user toggles again.
export function useCollapsible(autoCollapsed: boolean) {
  const [manual, setManual] = useState<boolean | null>(null);
  const isCollapsed = manual ?? autoCollapsed;
  const toggle = useCallback(() => {
    setManual((current) => !(current ?? autoCollapsed));
  }, [autoCollapsed]);
  return { isCollapsed, toggle };
}
