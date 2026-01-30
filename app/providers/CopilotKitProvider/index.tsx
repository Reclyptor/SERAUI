"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import "@copilotkit/react-ui/styles.css";
import { ImageCacheProvider } from "../../contexts/ImageCacheContext";
import { signInWithAuthentik } from "@/lib/auth-actions";

function CopilotKitWrapper({ children, accessToken }: { children: React.ReactNode; accessToken: string }) {
  // Memoize headers to prevent unnecessary re-renders, but update when token changes
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  return (
    <CopilotKit
      // Key forces re-initialization when token changes
      key={accessToken}
      runtimeUrl={process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL ?? "http://localhost:3001/copilotkit"}
      agent="SERA"
      headers={headers}
    >
      {children}
    </CopilotKit>
  );
}

export function CopilotKitProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status, update } = useSession();

  // Handle token refresh errors by redirecting to sign in
  useEffect(() => {
    if (session?.error === "RefreshError") {
      signInWithAuthentik();
    }
  }, [session?.error]);

  // Proactively refresh session when it might be getting stale
  useEffect(() => {
    if (status !== "authenticated") return;

    // Check session freshness every 5 minutes
    const interval = setInterval(() => {
      update();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [status, update]);

  if (status === "loading") {
    return (
      <ImageCacheProvider>
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-foreground-muted">Loading...</div>
        </div>
      </ImageCacheProvider>
    );
  }

  if (status !== "authenticated" || !session?.accessToken) {
    return (
      <ImageCacheProvider>
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-foreground-muted">Authenticating...</div>
        </div>
      </ImageCacheProvider>
    );
  }

  return (
    <ImageCacheProvider>
      <CopilotKitWrapper accessToken={session.accessToken}>
        {children}
      </CopilotKitWrapper>
    </ImageCacheProvider>
  );
}
