"use client";

import { type ReactNode } from "react";

interface CollapsibleProps {
  isOpen: boolean;
  durationMs?: number;
  children: ReactNode;
}

// Grid-rows animation pattern: animate `1fr <-> 0fr` on the outer grid
// while the inner wrapper holds `overflow-hidden min-h-0`. Smoother and
// content-aware than `max-height` animations.
export function Collapsible({
  isOpen,
  durationMs = 200,
  children,
}: CollapsibleProps) {
  return (
    <div
      className="grid transition-[grid-template-rows] ease-[cubic-bezier(0.2,0,0,1)]"
      style={{
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        transitionDuration: `${durationMs}ms`,
      }}
    >
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  );
}
