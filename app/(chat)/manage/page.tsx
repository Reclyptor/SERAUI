"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { PromptsPanel } from "@/app/components/PromptsPanel";
import { SkillsPanel } from "@/app/components/SkillsPanel";

const TABS = ["prompts", "skills"] as const;
type Tab = (typeof TABS)[number];

function ManageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as Tab) ?? "prompts";

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
        {activeTab === "prompts" ? <PromptsPanel /> : <SkillsPanel />}
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
