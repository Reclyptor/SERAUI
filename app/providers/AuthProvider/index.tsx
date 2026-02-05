"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { ImageCacheProvider } from "../../contexts/ImageCacheContext";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession();
  const reauthTriggered = useRef(false);

  const isRefreshError = session?.error === "RefreshError";

  // Hard redirect to login if refresh failed or session is unauthenticated
  useEffect(() => {
    if (status !== "unauthenticated" && !isRefreshError) return;
    if (reauthTriggered.current) return;
    if (window.location.pathname.startsWith("/api/auth")) return;

    reauthTriggered.current = true;
    window.location.replace("/api/auth/signin");
  }, [status, isRefreshError]);

  useEffect(() => {
    if (status === "authenticated" && !isRefreshError) {
      reauthTriggered.current = false;
    }
  }, [status, isRefreshError]);

  // Only show loading on initial page load (no session data yet)
  if (status === "loading" && !session) {
    return (
      <ImageCacheProvider>
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-foreground-muted">Loading...</div>
        </div>
      </ImageCacheProvider>
    );
  }

  // Not authenticated or refresh failed - redirect will happen, show auth state
  if (status === "unauthenticated" || isRefreshError) {
    return (
      <ImageCacheProvider>
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-foreground-muted">Authenticating...</div>
        </div>
      </ImageCacheProvider>
    );
  }

  // Authenticated - all API auth is done via session cookies
  return (
    <ImageCacheProvider>
      {children}
    </ImageCacheProvider>
  );
}
