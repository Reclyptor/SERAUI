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

  // Render nothing while redirecting to login (client-side session expiry)
  if (status === "unauthenticated" || isRefreshError) {
    return null;
  }

  return (
    <ImageCacheProvider>
      {children}
    </ImageCacheProvider>
  );
}
