"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef } from "react";
import "@copilotkit/react-ui/styles.css";
import { ImageCacheProvider } from "../../contexts/ImageCacheContext";
import { signInWithAuthentik } from "@/lib/auth-actions";

function CopilotKitWrapper({ children, accessToken }: { children: React.ReactNode; accessToken: string }) {
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken]
  );

  return (
    <CopilotKit
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
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle token refresh errors by redirecting to sign in
  useEffect(() => {
    if (session?.error === "RefreshError") {
      signInWithAuthentik();
    }
  }, [session?.error]);

  // Smart token refresh - schedule refresh 60 seconds before expiry
  useEffect(() => {
    if (status !== "authenticated" || !session?.expiresAt) return;

    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Calculate time until we should refresh (60s before expiry)
    const expiresAtMs = session.expiresAt * 1000;
    const refreshAtMs = expiresAtMs - 60000; // 60 seconds before expiry
    const timeUntilRefresh = refreshAtMs - Date.now();

    if (timeUntilRefresh <= 0) {
      // Token is already expired or about to expire, refresh now
      update();
    } else {
      // Schedule refresh for 60 seconds before expiry
      refreshTimeoutRef.current = setTimeout(() => {
        update();
      }, timeUntilRefresh);
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [status, session?.expiresAt, update]);

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
