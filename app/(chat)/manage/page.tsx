"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { PromptsPanel } from "@/app/components/PromptsPanel";
import { SkillsPanel } from "@/app/components/SkillsPanel";
import { MemoriesPanel } from "@/app/components/MemoriesPanel";
import { AgentsPanel } from "@/app/components/AgentsPanel";
import { HeartbeatsPanel } from "@/app/components/HeartbeatsPanel";
import { CronsPanel } from "@/app/components/CronsPanel";

const TABS = [
  "prompts",
  "skills",
  "memories",
  "agents",
  "heartbeats",
  "crons",
] as const;
type Tab = (typeof TABS)[number];

const PANELS: Record<Tab, React.ComponentType> = {
  prompts: PromptsPanel,
  skills: SkillsPanel,
  memories: MemoriesPanel,
  agents: AgentsPanel,
  heartbeats: HeartbeatsPanel,
  crons: CronsPanel,
};

function ManageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab =
    requestedTab && TABS.includes(requestedTab) ? requestedTab : "prompts";
  const ActivePanel = PANELS[activeTab];

  const setTab = (tab: Tab) => {
    router.replace(`/manage?tab=${tab}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-6 pt-3 pb-0 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
              activeTab === tab
                ? "bg-background-tertiary text-foreground"
                : "text-foreground-muted hover:text-foreground hover:bg-background-secondary",
            )}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        <ActivePanel />
      </div>
    </div>
  );
}

export default function ManagePage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
        </div>
      }
    >
      <ManageContent />
    </Suspense>
  );
}
