"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import "@copilotkit/react-ui/styles.css";
import { ImageCacheProvider } from "../../contexts/ImageCacheContext";
import { signInWithAuthentik } from "@/lib/auth-actions";

interface CopilotKitProviderProps {
  children: React.ReactNode;
  runtimeUrl: string;
}

interface AuthenticatedContentProps {
  children: React.ReactNode;
  accessToken: string;
  runtimeUrl: string;
}

function AuthenticatedContent({ children, accessToken, runtimeUrl }: AuthenticatedContentProps) {
  // Clone children and pass accessToken and runtimeUrl as props
  // Children (page.tsx) will handle CopilotKit provider
  return (
    <>
      {typeof children === 'function' 
        ? children({ accessToken, runtimeUrl })
        : children}
    </>
  );
}

export function CopilotKitProvider({ children, runtimeUrl }: CopilotKitProviderProps) {
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
      <AuthContext.Provider value={{ accessToken: session.accessToken, runtimeUrl }}>
        {children}
      </AuthContext.Provider>
    </ImageCacheProvider>
  );
}

// Context to pass auth info to page components
import { createContext, useContext } from "react";

interface AuthContextValue {
  accessToken: string;
  runtimeUrl: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within CopilotKitProvider");
  }
  return context;
}
