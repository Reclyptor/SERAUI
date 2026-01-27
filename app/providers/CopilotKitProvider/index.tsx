"use client";

import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { ImageCacheProvider } from "../../contexts/ImageCacheContext";

export function CopilotKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <ImageCacheProvider>
      <CopilotKit
        runtimeUrl={process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL ?? "http://localhost:3001/copilotkit"}
        agent="SERA"
      >
        {children}
      </CopilotKit>
    </ImageCacheProvider>
  );
}
