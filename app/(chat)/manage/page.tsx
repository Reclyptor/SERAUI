"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, type ComponentType } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { PromptsPanel } from "@/app/components/PromptsPanel";
import { SkillsPanel } from "@/app/components/SkillsPanel";
import { MemoriesPanel } from "@/app/components/MemoriesPanel";
import { AgentsPanel } from "@/app/components/AgentsPanel";
import { HeartbeatsPanel } from "@/app/components/HeartbeatsPanel";
import { CronsPanel } from "@/app/components/CronsPanel";

interface TabConfig {
  id: string;
  label: string;
  Panel: ComponentType;
}

// Single source of tab id, label, and panel — adding a new manage tab is one
// row here. Labels are explicit so "Cron Jobs" doesn't render as "crons" via
// `capitalize`.
const TAB_CONFIG = [
  { id: "prompts", label: "Prompts", Panel: PromptsPanel },
  { id: "skills", label: "Skills", Panel: SkillsPanel },
  { id: "memories", label: "Memories", Panel: MemoriesPanel },
  { id: "agents", label: "Agents", Panel: AgentsPanel },
  { id: "heartbeats", label: "Heartbeats", Panel: HeartbeatsPanel },
  { id: "crons", label: "Cron Jobs", Panel: CronsPanel },
] as const satisfies readonly TabConfig[];

type Tab = (typeof TAB_CONFIG)[number]["id"];

function isTab(value: string | null): value is Tab {
  return value !== null && TAB_CONFIG.some((t) => t.id === value);
}

function ManageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requested = searchParams.get("tab");
  const activeTab: Tab = isTab(requested) ? requested : "prompts";
  const active = TAB_CONFIG.find((t) => t.id === activeTab) ?? TAB_CONFIG[0];
  const ActivePanel = active.Panel;

  const setTab = (tab: Tab) => {
    router.replace(`/manage?tab=${tab}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-6 pt-3 pb-0 shrink-0">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-background-tertiary text-foreground"
                : "text-foreground-muted hover:text-foreground hover:bg-background-secondary",
            )}
          >
            {tab.label}
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
